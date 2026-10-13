voa
```
docker run -d   --name srt_worker_final   -v /home/devops/english/voa:/app   my_ocr_env:v1   tail -f /dev/null
```
# todo
1. 视频分片上传
2. 视频分片下载 流媒体服务器
3. 用户登陆注册
4. 闹钟提醒
5. 视频的 thumb
6. 自动更新
7. 列表排序
8. 开一个dingding接口给前端调
9. 左滑右滑操作
10. 日期bug 原图加载bug
11. 回退的时候如果遇到了浮层 和 表单的处理
12. 头像缩略图
13. 测试版本更新
14. 预览图片时候的左右划动和后退
15. 其他编辑状态的回退


# frp
/home/devops/frp
./frpc -c ./frpc.ini &

[common]
server_addr = 47.99.192.24
server_port = 7000
token = xxxx
[ssh-home]
type = tcp
local_ip = 127.0.0.1
local_port = 22
remote_port = 5001
[samba-home]
type = tcp
local_ip = 127.0.0.1
local_port = 8002
remote_port = 5002
[web]
type = tcp
local_ip = 127.0.0.1
local_port = 3330
remote_port = 5004

## server
[common]
bind_port = 7000
token = xxxx


vi /lib/systemd/system/frpc.service

```
[Unit]
Description=Frpc Client Service
After=network.target

[Service]
TimeoutStartSec=30
Restart=on-failure
RestartSec=5s
ExecStart=/home/devops/frp/frpc -c /home/devops/frp/frpc.ini
ExecStop=/bin/kill $MAINPID
ExecReload=/home/devops/frp/frpc reload -c /home/devops/frp/frpc.ini

[Install]
WantedBy=multi-user.target
```
systemctl enable frpc



# docker
systemctl start  docker.service
docker commit 6b66beb4983d my_ocr_env:v1
 //docker run -d -it   --name srt_worker_final   -v $(pwd):/app   paddleocr/paddleocr:latest   /bin/bash
docker run -d   --name srt_worker_final   -v /home/devops/music/voa:/app   my_ocr_env:v1   tail -f /dev/null





# o
yum install audacious
sudo yum install vlc
yum install mplayer
aplay -l
sudo yum install samba samba-common samba-client
systemctl status mysqld
ffmpeg -v
npm i anywhere -g
ip addr
vi /etc/sysconfig/network-scripts/ifcfg-eno1 
systemctl restart network
yum install nginx
service postgresql restart
yum install onlyoffice-documentserver
yum -y install redis
yum install node
yum install supervisor
yum install pwgen
yum install -y python-setuptools
yum install -y python3-pip
yum install docker-ce docker-ce-cli containerd.io
systemctl start  docker.service
wget https://ollama.com/download/ollama-linux-amd64.tgz

https://192.168.0.111:3330/baby/image/admin
https://192.168.0.111:3330/baby/video/admin
https://192.168.0.111:3330/song
https://192.168.0.111:3330/todo
https://192.168.0.111:3330/voa
https://192.168.0.111:3330/voa/lrc
https://192.168.0.111:3330/public/baby/