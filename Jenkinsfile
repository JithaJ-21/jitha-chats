pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/JithaJ-21/jitha-chats'
            }
        }

        stage('Build') {
            steps {
                echo 'Building the project...'
                sh 'echo Build step executed'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                sh 'echo Test step executed'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying the application...'
                bat 'echo Deploy step executed'
            }
        }
    }
}

