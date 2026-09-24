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

        stage('Docker Deploy') {
            steps {
                echo 'Creating environment configuration...'

                withCredentials([
                    string(credentialsId: 'GOOGLE_CLIENT_ID', variable: 'GOOGLE_CLIENT_ID'),
                    string(credentialsId: 'GOOGLE_CLIENT_SECRET', variable: 'GOOGLE_CLIENT_SECRET'),
                    string(credentialsId: 'TOKEN_ENCRYPTION_KEY', variable: 'TOKEN_ENCRYPTION_KEY'),
                    string(credentialsId: 'DB_USERNAME', variable: 'DB_USERNAME'),
                    string(credentialsId: 'DB_PASSWORD', variable: 'DB_PASSWORD'),
                    string(credentialsId: 'SPRING_PROFILES_ACTIVE', variable: 'SPRING_PROFILES_ACTIVE')
                ]) {

                    sh '''
                        echo "Creating backend environment file..."

                        cat > backend/.env <<EOF
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE}
EOF

                        echo "Stopping previous CloudValut containers..."
                        docker compose down || true

                        echo "Building and starting CloudValut..."
                        docker compose up -d --build
                    '''
                }
            }
        }

        stage('Deployment Check') {
            steps {
                echo 'Checking deployed containers...'

                sh '''
                    docker compose ps
                '''
            }
        }
    }

    post {
        success {
            echo '========================================='
            echo 'CloudValut deployment successful!'
            echo 'Frontend: http://localhost:5173'
            echo 'Backend:  http://localhost:9090'
            echo '========================================='
        }

        failure {
            echo '========================================='
            echo 'CloudValut Jenkins pipeline failed.'
            echo 'Check the console output for details.'
            echo '========================================='
        }
    }
}