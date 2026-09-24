pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out CloudValut source code...'
                checkout scm
            }
        }

        stage('Backend Build') {
            steps {
                echo 'Building Spring Boot backend...'

                dir('backend') {
                    sh 'chmod +x mvnw'
                    sh './mvnw clean package -DskipTests'
                }
            }
        }

        stage('Backend Test') {
            steps {
                echo 'Running backend tests...'

                dir('backend') {
                    sh './mvnw test'
                }
            }
        }

        stage('Frontend Install') {
            steps {
                echo 'Installing frontend dependencies...'

                dir('frontend') {
                    sh 'npm install'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                echo 'Building React frontend...'

                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }
    }

    post {
        success {
            echo 'CloudValut Jenkins pipeline completed successfully!'
        }

        failure {
            echo 'CloudValut Jenkins pipeline failed.'
        }
    }
}