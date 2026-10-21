// 보이지 않는 호스트 창: 메인 프로세스의 요청으로 메모 창을 엽니다.
window.api.onHostOpen(({ url, name }) => {
  window.open(url, name);
});
window.api.hostReady();
