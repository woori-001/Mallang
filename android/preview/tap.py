# 확인용: 에뮬레이터 화면에서 글자로 단추를 찾아 누름 (예: python3 tap.py "지금 받기")
import re, subprocess, sys
xml = subprocess.run(['adb', 'exec-out', 'uiautomator', 'dump', '/dev/tty'], capture_output=True, text=True).stdout
m = re.search(r'text="' + re.escape(sys.argv[1]) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if not m:
    print('못 찾음:', sys.argv[1]); sys.exit(0)
x, y = (int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2
subprocess.run(['adb', 'shell', 'input', 'tap', str(x), str(y)])
print('누름', sys.argv[1], x, y)
