import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { format, parseISO } from "date-fns";
import { it as itLocale, enUS } from "date-fns/locale";

interface NotesHistorySectionProps {
  areaId: string;
  isDemo?: boolean;
}

interface Note {
  id: string;
  date: string;
  content: string;
}

export function NotesHistorySection({ areaId, isDemo }: NotesHistorySectionProps) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (isDemo || !user) { setLoading(false); return; }
    const { data } = await supabase
      .from("activity_notes")
      .select("id, date, content")
      .eq("area_id", areaId)
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  }, [areaId, user, isDemo]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const formatDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return locale === "it"
      ? format(d, "d MMM yyyy", { locale: itLocale })
      : format(d, "MMM d, yyyy", { locale: enUS });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {locale === "it" ? "Appunti" : "Notes"}
        </h3>
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl bg-card animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {locale === "it" ? "Appunti" : "Notes"}
      </h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {locale === "it"
            ? "Nessun appunto ancora. Gli appunti si aggiungono dalla Home durante il log."
            : "No notes yet. Notes are added from Home when logging."}
        </p>
      ) : (
        notes.map(note => (
          <div key={note.id} className="rounded-xl bg-card p-4 space-y-1">
            <p className="text-sm text-muted-foreground">{formatDate(note.date)}</p>
            <p className="text-base text-foreground">{note.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
