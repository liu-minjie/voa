import cv2
import numpy as np
from paddleocr import PaddleOCR
import os
import sys
import difflib

# 1. 初始化 OCR (识别中文和英文)
ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)

def get_similarity(s1, s2):
    """计算两个字符串的相似度"""
    return difflib.SequenceMatcher(None, s1, s2).ratio()

def main():
    # --- 【参数解析区】 ---
    if len(sys.argv) < 6:
        print("用法错误！示例: python3 extract_srt.py /app/video/test.mp4 800 1000 0 -1")
        sys.exit(1)

    video_arg = sys.argv[1]
    y_start = int(sys.argv[2])
    y_end = int(sys.argv[3])
    x_start = int(sys.argv[4])
    x_end = int(sys.argv[5])

    # --- 【路径修复逻辑区】 ---
    # 1. 确定视频输入的绝对路径
    if video_arg.startswith('/'):
        video_path = video_arg
    else:
        video_path = os.path.join("/app", video_arg)

    # 2. 核心修复：获取纯文件名 (例如从 /app/video/1950_mixer.mp4 提取出 1950_mixer.mp4)
    pure_video_filename = os.path.basename(video_path)
    
    # 3. 获取不带后缀的名称 (例如 1950_mixer)
    folder_name = os.path.splitext(pure_video_filename)[0]

    # 4. 设定输出目录：/app/media/o/1950_mixer
    output_dir = os.path.join("/app/media/o", folder_name)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 5. 最终 LRC 路径：/app/media/o/1950_mixer/1950_mixer.lrc
    lrc_path = os.path.join(output_dir, f"{folder_name}.lrc")
    
    # --- 【配置区】 ---
    sample_rate = 0.5  # 每 0.5 秒提取一次
    similarity_threshold = 0.8  # 相似度过滤阈值

    # --- 【执行逻辑区】 ---
    if not os.path.exists(video_path):
        print(f"错误：找不到视频文件 {video_path}")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        print("错误：无法读取视频帧率")
        sys.exit(1)
        
    frame_interval = int(fps * sample_rate)
    
    count = 0
    last_text = ""

    with open(lrc_path, "w", encoding="utf-8") as f:
        print(f"正在提取: {video_path}")
        print(f"输出目录: {output_dir}")
        print(f"LRC 路径: {lrc_path}")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            if count % frame_interval == 0:
                # 区域裁剪
                roi = frame[y_start:y_end, x_start:] if x_end == -1 else frame[y_start:y_end, x_start:x_end]

                # 执行 OCR
                results = ocr.ocr(roi)
                
                if results and results[0]:
                    # 合并结果并按置信度过滤
                    current_text = " ".join([line[1][0].strip() for line in results[0] if line[1][1] > 0.6])
                    
                    # 只有在有文字且与上一句不重复时才写入
                    if current_text:
                        similarity = get_similarity(current_text, last_text)
                        if similarity < similarity_threshold:
                            # 时间戳换算
                            ms = int((count / fps) * 1000)
                            minutes = ms // 60000
                            seconds = (ms % 60000) // 1000
                            msec = (ms % 1000) // 10
                            
                            time_str = f"[{minutes:02d}:{seconds:02d}.{msec:02d}]"
                            f.write(f"{time_str}{current_text}\n")
                            # 强制刷新缓冲区，方便在日志中实时观察
                            f.flush()
                            print(f"{time_str} {current_text}")
                            last_text = current_text

            count += 1
            
    cap.release()
    print(f"\n任务完成！")
    print(f"LRC 文件已保存在: {lrc_path}")

if __name__ == "__main__":
    main()
