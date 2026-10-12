pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Validate Source') {
            steps {
                sh '''
                    set -eu
                    test -f app.py
                    test -f requirements.txt
                    test -d templates
                    test -d static
                    python3 -m py_compile app.py
                    echo "Source validation passed"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    set -eu
                    docker build -t system-monitor:${BUILD_NUMBER} .
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    set -eu

                    CONTAINER_NAME="system-monitor-ci-${BUILD_NUMBER}"

                    cleanup() {
                        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
                    }
                    trap cleanup EXIT

                    docker run -d \
                        --name "$CONTAINER_NAME" \
                        -p 127.0.0.1::5000 \
                        "system-monitor:${BUILD_NUMBER}"

                    HOST_PORT=$(docker port "$CONTAINER_NAME" 5000/tcp | sed 's/.*://')

                    i=0
                    until curl -fsS "http://127.0.0.1:${HOST_PORT}/api/metrics" >/dev/null; do
                        i=$((i + 1))
                        if [ "$i" -ge 20 ]; then
                            docker logs "$CONTAINER_NAME"
                            exit 1
                        fi
                        sleep 1
                    done

                    echo "API smoke test passed"
                '''
            }
        }
    }

    post {
        success {
            echo 'CI pipeline completed successfully!'
        }
        failure {
            echo 'CI pipeline failed. Check the stage logs.'
        }
    }
}
