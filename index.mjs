import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = "ChatConnections";
const ddbClient = new DynamoDBClient({});

async function sendToOne(apiClient, connectionId, data) {
  try {
    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data))
    }));
  } catch (err) {
    if (err.statusCode === 410) {
      console.log(`💀 Connection ${connectionId} is stale. Deleting...`);
      await ddbClient.send(new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { connectionId: { S: connectionId } }
      }));
    } else {
      console.error("Error sending to one:", err);
    }
  }
}

async function broadcast(apiClient, message) {
  const connections = await ddbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  if (!connections.Items) return;

  await Promise.all(
    connections.Items.map(conn =>
      sendToOne(apiClient, conn.connectionId.S, message)
    )
  );
}

export const handler = async (event) => {
  console.log("📥 Event:", JSON.stringify(event, null, 2));

  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });

  try {
    switch (routeKey) {
      // 1️⃣ When a user connects
      case "$connect":
        await ddbClient.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: { connectionId: { S: connectionId } }
        }));
        console.log(`✅ Connected: ${connectionId}`);
        return { statusCode: 200 };

      // 2️⃣ When a user disconnects
      case "$disconnect":
        await ddbClient.send(new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: { connectionId: { S: connectionId } }
        }));
        console.log(`❌ Disconnected: ${connectionId}`);
        return { statusCode: 200 };

      // 3️⃣ When a user sets their name
      case "setName": {
        const body = JSON.parse(event.body || "{}");
        const name = body.name || "Anonymous";

        await ddbClient.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: {
            connectionId: { S: connectionId },
            name: { S: name }
          }
        }));

        console.log(`🙋‍♂️ ${name} joined`);

        await broadcast(apiClient, {
          systemMessage: `${name} joined the chat`
        });

        // send updated member list
        const members = await ddbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        const memberNames = members.Items.map(i => i.name?.S || "Anonymous");

        await broadcast(apiClient, { members: memberNames });

        return { statusCode: 200 };
      }

      // 4️⃣ When a user sends a message
      case "sendMessage": {
        const body = JSON.parse(event.body || "{}");
        const message = body.message || "";

        if (!message) return { statusCode: 400, body: "Message required" };

        // find sender
        const connections = await ddbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        const sender = connections.Items.find(i => i.connectionId.S === connectionId);
        const senderName = sender?.name?.S || "Anonymous";

        await broadcast(apiClient, {
          from: senderName,
          message: message
        });

        console.log(`💬 ${senderName}: ${message}`);
        return { statusCode: 200 };
      }

      // 5️⃣ Fallback for unknown routes
      default:
        console.log("⚠️ Unknown route:", routeKey);
        return { statusCode: 400, body: "Invalid route" };
    }
  } catch (err) {
    console.error("💥 Error:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
