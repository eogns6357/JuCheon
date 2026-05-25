const BASE = {
  real: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
};

let _token: string | null = null;
let _tokenExpiry: number = 0;

export async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const mode = process.env.KIS_MODE ?? "real";
  const res = await fetch(`${BASE[mode as keyof typeof BASE]}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return _token!;
}

export async function kisGet(path: string, params: Record<string, string>, trId: string) {
  const mode = process.env.KIS_MODE ?? "real";
  const token = await getToken();
  const url = new URL(`${BASE[mode as keyof typeof BASE]}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APP_KEY!,
      appsecret: process.env.KIS_APP_SECRET!,
      tr_id: trId,
      custtype: "P",
    },
    next: { revalidate: 30 },
  });
  return res.json();
}
