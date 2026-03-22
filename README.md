voa
docker run -d   --name srt_worker_final   -v /home/devops/english/voa:/app   my_ocr_env:v1   tail -f /dev/null
