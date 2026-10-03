/** 家属令牌：优先 URL query（?token=xxx，来自管家分享的链接），其次本地存储 */
export function getFamilyToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('token');
  if (q) {
    localStorage.setItem('family_token', q);
    // 清掉地址栏上的 token，避免转发泄露
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState(null, '', url.toString());
    return q;
  }
  return localStorage.getItem('family_token');
}
