"use client";

import { useEffect, useState } from "react";

export async function api(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      },
      body: typeof options.body === "string" || options.body === undefined ? options.body : JSON.stringify(options.body)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network request failed";
    throw new Error(`无法连接 TEAMAKING API：${detail}。请确认当前域名允许访问该入口，或稍后刷新重试。`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.errorCode ? `（代码：${data.errorCode}；请求：${data.requestId ?? "unknown"}）` : "";
    throw new Error(`${data.error ?? "请求失败，请稍后再试。"}${code}`);
  }

  return data;
}

export async function uploadProfileFile(file: File, purpose: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.errorCode ? `（代码：${data.errorCode}；请求：${data.requestId ?? "unknown"}）` : "";
    throw new Error(`${data.error ?? "上传失败，请稍后再试。"}${code}`);
  }

  return data.upload;
}

export function useApi(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    api(path)
      .then((value) => {
        if (alive) {
          setData(value);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, error, loading };
}
