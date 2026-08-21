pipeline {
    agent any

    environment {
        REGISTRY   = "registry.digitalocean.com/demo-registry-cnl"
        IMAGE_NAME = "demo-app"
        NAMESPACE  = "demo"
        DEPLOYMENT = "demo-app"
        CONTAINER  = "demo-app"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHA_SHORT = sh(script: "git rev-parse --short=7 HEAD", returnStdout: true).trim()
                }
            }
        }

        stage('Install/Test') {
            steps {
                dir('app') {
                    sh 'npm install'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker image') {
            steps {
                sh "docker build -t ${REGISTRY}/${IMAGE_NAME}:${env.GIT_SHA_SHORT} ."
            }
        }

        stage('Push to DOCR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'docr-credentials', usernameVariable: 'DOCR_USER', passwordVariable: 'DOCR_TOKEN')]) {
                    sh '''
                        echo "$DOCR_TOKEN" | docker login registry.digitalocean.com -u "$DOCR_USER" --password-stdin
                        docker push ${REGISTRY}/${IMAGE_NAME}:${GIT_SHA_SHORT}
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'doks-kubeconfig', variable: 'KUBECONFIG')]) {
                    sh '''
                        kubectl set image deployment/${DEPLOYMENT} ${CONTAINER}=${REGISTRY}/${IMAGE_NAME}:${GIT_SHA_SHORT} -n ${NAMESPACE}
                        kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE} --timeout=90s
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout registry.digitalocean.com || true'
        }
    }
}
