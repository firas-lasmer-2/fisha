import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ListenerHallOfFameEntry } from "@shared/schema";
import { Crown, Medal, Sparkles, Star, Trophy } from "lucide-react";

interface PublicLeaderboardEntry {
  listenerId: string;
  rank: number;
  displayName: string;
  level: number;
  points: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  trophyTier: "gold" | "silver" | "bronze" | null;
  certificationTitle: string | null;
}

interface PublicLeaderboardPayload {
  seasonKey: string;
  leaderboard: PublicLeaderboardEntry[];
  hallOfFame: ListenerHallOfFameEntry[];
}

export default function ListenerHallOfFamePage() {
  const { t } = useI18n();
  const [selectedSeason, setSelectedSeason] = useState("");

  const { data, isLoading } = useQuery<PublicLeaderboardPayload>({
    queryKey: ["/api/public/listener/leaderboard", selectedSeason],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (selectedSeason) params.set("season", selectedSeason);
      const res = await fetch(`/api/public/listener/leaderboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

  useEffect(() => {
    if (!selectedSeason && data?.seasonKey) {
      setSelectedSeason(data.seasonKey);
    }
  }, [data?.seasonKey, selectedSeason]);

  const leaderboard = data?.leaderboard || [];
  const podium = leaderboard.slice(0, 3);
  const topPoints = leaderboard[0]?.points ?? 1;

  const seasonOptions = useMemo(() => {
    const keys = new Set<string>();
    if (data?.seasonKey) keys.add(data.seasonKey);
    for (const entry of data?.hallOfFame || []) {
      keys.add(entry.seasonKey);
    }
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [data?.hallOfFame, data?.seasonKey]);

  const hallOfFameBySeason = useMemo(() => {
    const grouped = new Map<string, ListenerHallOfFameEntry[]>();
    for (const entry of data?.hallOfFame || []) {
      const list = grouped.get(entry.seasonKey) || [];
      list.push(entry);
      grouped.set(entry.seasonKey, list);
    }
    return Array.from(grouped.entries())
      .map(([seasonKey, entries]) => ({
        seasonKey,
        entries: entries.sort((a, b) => a.rank - b.rank),
      }))
      .sort((a, b) => b.seasonKey.localeCompare(a.seasonKey));
  }, [data?.hallOfFame]);

  const trophyIcon = (tier: "gold" | "silver" | "bronze" | null) => {
    if (tier === "gold") return "🏆";
    if (tier === "silver") return "🥈";
    if (tier === "bronze") return "🥉";
    return "🎖️";
  };
  const trophyCardClass = (tier: "gold" | "silver" | "bronze" | null) => {
    if (tier === "gold") return "from-amber-200/90 to-amber-50 dark:from-amber-500/20 dark:to-amber-950/20 border-amber-300/80";
    if (tier === "silver") return "from-slate-200/90 to-slate-50 dark:from-slate-500/20 dark:to-slate-950/20 border-slate-300/80";
    if (tier === "bronze") return "from-orange-200/90 to-orange-50 dark:from-orange-500/20 dark:to-orange-950/20 border-orange-300/80";
    return "from-muted/40 to-transparent border-border";
  };

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-gradient-to-r from-primary/10 via-chart-2/10 to-chart-4/10">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge className="bg-primary text-primary-foreground">
                <Trophy className="h-3.5 w-3.5 me-1.5" />
                {tr("nav.hall_of_fame", "Listener Hall of Fame")}
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-bold">
                Recognition For Compassion
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Monthly rankings celebrate listeners who consistently help with empathy, quality, and reliability.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/listener/apply">
                <Button>Become a listener</Button>
              </Link>
              <Link href="/peer-support">
                <Button variant="outline">Find support now</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Season Leaderboard</CardTitle>
              <div className="flex items-center gap-2">
                <label htmlFor="season-select" className="text-xs text-muted-foreground">Season</label>
                <select
                  id="season-select"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  {seasonOptions.map((season) => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr("listener.no_leaderboard", "No leaderboard data yet.")}</p>
            ) : (
              <>
                {podium.length > 0 && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    {podium.map((entry) => (
                      <div key={`podium-${entry.listenerId}`} className={`border rounded-xl p-3 bg-gradient-to-br ${trophyCardClass(entry.trophyTier)}`}>
                        <p className="text-2xl leading-none">{trophyIcon(entry.trophyTier)}</p>
                        <p className="text-xs mt-1 text-muted-foreground">#{entry.rank}</p>
                        <p className="text-sm font-semibold mt-1 truncate">{entry.displayName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.points} pts • {entry.averageRating.toFixed(2)} ★
                        </p>
                        {entry.certificationTitle && (
                          <Badge className="mt-2 bg-amber-600 hover:bg-amber-600 text-white">
                            {entry.certificationTitle}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div key={entry.listenerId} className="border rounded-md p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span>{trophyIcon(entry.trophyTier)}</span>
                            <span>#{entry.rank} {entry.displayName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Lvl {entry.level} • {entry.averageRating.toFixed(2)} ★ • streak {entry.positiveStreak}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {entry.certificationTitle && (
                            <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
                              Certified
                            </Badge>
                          )}
                          <Badge variant="outline">{entry.points} pts</Badge>
                        </div>
                      </div>
                      <Progress value={Math.max(3, Math.min(100, (entry.points / topPoints) * 100))} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Hall Of Fame Archive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hallOfFameBySeason.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archived seasons yet.</p>
            ) : (
              hallOfFameBySeason.map((season) => (
                <div key={season.seasonKey} className="border rounded-md p-3">
                  <p className="text-sm font-semibold mb-2">{season.seasonKey}</p>
                  <div className="space-y-1.5">
                    {season.entries.map((entry) => (
                      <div key={`${entry.seasonKey}-${entry.rank}-${entry.listenerId}`} className="text-xs flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <span>{trophyIcon(entry.trophyTier)}</span>
                          <span>#{entry.rank} {entry.displayName}</span>
                        </span>
                        <span className="font-medium">{entry.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-chart-2/10 via-primary/10 to-chart-4/10 border-primary/30">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Ready to earn your spot?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tr("nav.listener_apply", "Apply as listener")} and build recognition through quality support.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/listener/apply">
                <Button>
                  <Medal className="h-4 w-4 me-1.5" />
                  Apply
                </Button>
              </Link>
              <Link href="/therapists">
                <Button variant="outline">
                  <Star className="h-4 w-4 me-1.5" />
                  Find therapist
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

