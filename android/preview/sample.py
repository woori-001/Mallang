# 확인용 위젯 화면에 넣을 예시 일정 (실제 데이터 아님) → base64 로 출력
import base64, datetime, json, sys
skin = sys.argv[1] if len(sys.argv) > 1 else 'lav'
SK = {
  'lav': {'bg': '#EEF0FB', 'ink': '#2E3150', 'sub': '#535877', 'a1': '#5F67DE', 'sun': '#C2416A', 'sat': '#4A5BD6'},
  'peach': {'bg': '#FFF3EC', 'ink': '#4A3226', 'sub': '#8A6A5A', 'a1': '#E8835A', 'sun': '#D9534F', 'sat': '#4A7BD6'},
}[skin]
t = datetime.date.today()
k = lambda o: (t + datetime.timedelta(days=o)).isoformat()
C = {'lav': '#7466E4', 'mint': '#2A9D74', 'pink': '#D4508A', 'sky': '#3A7FD4'}
ev = {
  k(0): [('09:30', '주간 회의', 'lav'), ('15:00', '거래처 미팅', 'pink'), ('', '보고서 마감', 'mint'), ('18:30', '팀 회식', 'sky')],
  k(2): [('10:00', '교육', 'sky')], k(5): [('', '연차', 'mint'), ('14:00', '병원', 'pink')], k(-3): [('11:00', '정산', 'lav')], k(9): [('13:00', '외근', 'pink')],
}
days = {d: {'c': [C[x[2]] for x in v[:3]], 'h': ''} for d, v in ev.items()}
lst = {d: [{'t': a, 'n': b, 'c': C[c]} for a, b, c in sorted(v, key=lambda x: x[0])] for d, v in ev.items()}
print(base64.b64encode(json.dumps({'v': 1, 'skin': SK, 'days': days, 'list': lst}, ensure_ascii=False).encode()).decode())
