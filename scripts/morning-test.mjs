/**
 * 모닝 브리핑 로컬 테스트
 * 실행: npm run morning  (개발 서버 npm run dev 켜진 상태에서)
 */
const res = await fetch("http://localhost:3000/api/cron/morning-brief", {
  headers: { Authorization: "Bearer test" },
});
const data = await res.json();
console.log(data.ok ? `✅ 발송 완료 (${data.length}자)` : `❌ 실패: ${data.error}`);
