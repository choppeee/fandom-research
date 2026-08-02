"use client";

import { useEffect, useState } from "react";

type Connection = {
  id: string;
  accountName: string | null;
  accountType: string | null;
  tokenExpiresAt: string | null;
  connectionStatus: string;
  createdAt: string;
};

export function AccountConnectTab() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/connections/instagram/accounts");
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setConnections(data.connections ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDisconnect(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/connections/instagram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">연결 상태를 확인하는 중...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-line bg-surface-soft px-3.5 py-3 text-xs leading-relaxed text-ink-secondary">
        본인이 관리하는 Instagram 비즈니스/크리에이터 계정을 연결하면 게시물과 댓글을 공식 API로
        정기적으로 분석할 수 있습니다. 연결은 Meta(Facebook) 로그인을 통해 이루어지며, 토큰은 서버에서
        암호화되어 저장됩니다.
      </div>

      {configured === false && (
        <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-ink" role="alert">
          아직 Meta 앱 자격증명이 설정되지 않아 계정 연결을 사용할 수 없습니다. 관리자에게 문의하세요.
        </p>
      )}

      {configured && (
        <a
          href="/api/connections/instagram/start"
          className="inline-flex items-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Instagram 계정 연결하기
        </a>
      )}

      {connections.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">연결된 계정</p>
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-soft p-3 text-sm">
              <div>
                <p className="font-medium text-ink">@{c.accountName ?? "알 수 없음"}</p>
                <p className="text-xs text-ink-muted">
                  {c.connectionStatus === "active" ? "연결됨" : c.connectionStatus}
                  {c.tokenExpiresAt && ` · 토큰 만료 ${c.tokenExpiresAt.slice(0, 10)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDisconnect(c.id)}
                disabled={busyId === c.id}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-secondary hover:border-danger hover:text-danger disabled:opacity-50"
              >
                {busyId === c.id ? "해제 중..." : "연결 해제"}
              </button>
            </div>
          ))}
        </div>
      )}

      {connections.length === 0 && configured && (
        <p className="text-sm text-ink-muted">아직 연결된 계정이 없습니다. 위 버튼으로 연결을 시작하세요.</p>
      )}

      <p className="text-xs text-ink-muted">
        연결 해제 시 저장된 토큰은 즉시 삭제되며, 이후 이 계정의 게시물/댓글을 다시 수집하려면
        재연결이 필요합니다.
      </p>
    </div>
  );
}
