"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Trash2, Copy, Check, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";
import { getActiveShareLinks, revokeShareLink, type ShareLinkItem } from "@/lib/actions/share";
import { toast } from "sonner";

type Props = {
  recordId: string;
  refreshKey?: number;
};

export function ActiveShareLinks({ recordId, refreshKey = 0 }: Props) {
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActiveShareLinks(recordId);
      setLinks(res);
    } catch (err) {
      console.error("Failed to fetch active share links:", err);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks, refreshKey]);

  async function handleRevoke(linkId: string) {
    try {
      await revokeShareLink(linkId);
      toast.success("Share link revoked");
      await fetchLinks();
    } catch (err) {
      console.error("Failed to revoke share link:", err);
      toast.error("Failed to revoke share link");
    }
  }

  function handleCopy(token: string, linkId: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    toast.success("Share link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading && links.length === 0) return null;
  if (!loading && links.length === 0) return null;

  return (
    <Card className="mt-6 border-border">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Active Public Share Links ({links.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <ul className="divide-y divide-border">
          {links.map((link) => (
            <li key={link.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-mono text-muted-foreground truncate max-w-[280px] sm:max-w-md">
                  /s/{link.token.slice(0, 16)}...
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Expires: {formatDate(link.expiresAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleCopy(link.token, link.id)}
                >
                  {copiedId === link.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                  onClick={() => handleRevoke(link.id)}
                >
                  <Trash2 className="h-3 w-3" /> Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
