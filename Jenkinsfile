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
                bat 'echo Build step executed'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                bat 'echo Test step executed'
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

