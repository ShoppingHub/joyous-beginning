import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Minus } from "lucide-react";

interface QuantityCounterProps {
  areaId: string;
  date: string;
  isFutureDay: boolean;
}

export function QuantityCounter({ areaId, date, isFutureDay }: QuantityCounterProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [recorded, setRecorded] = useState(false);

  const fetchQuantity = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("habit_quantity_daily" as any)
      .select("quantity")
      .eq("area_id", areaId)
      .eq("date", date)
      .single();
    if (data) setQuantity((data as any).quantity);
    else setQuantity(0);
  }, [user, areaId, date]);

  useEffect(() => { fetchQuantity(); }, [fetchQuantity]);

  const showRecorded = () => {
    setRecorded(true);
    setTimeout(() => setRecorded(false), 1000);
  };

  const saveQuantity = async (newQty: number, source: "quick_add" | "manual_edit") => {
    if (!user) return;
    setQuantity(newQty);
    showRecorded();

    const { data: existing } = await supabase
      .from("habit_quantity_daily" as any)
      .select("id")
      .eq("area_id", areaId)
      .eq("date", date)
      .single();

    if (existing) {
      await (supabase.from("habit_quantity_daily" as any) as any).update({
        quantity: newQty,
        source,
        updated_at: new Date().toISOString(),
      }).eq("area_id", areaId).eq("date", date);
    } else {
      await (supabase.from("habit_quantity_daily" as any) as any).insert({
        area_id: areaId,
        date,
        quantity: newQty,
        source,
      });
    }
  };

  const handlePlus = () => {
    if (isFutureDay) return;
    saveQuantity(quantity + 1, "quick_add");
  };

  const handleMinus = () => {
    if (isFutureDay || quantity <= 0) return;
    saveQuantity(quantity - 1, "manual_edit");
  };

  const handleEditSubmit = () => {
    const val = parseInt(editValue, 10);
    const newQty = isNaN(val) || val < 0 ? 0 : val;
    saveQuantity(newQty, "manual_edit");
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Minus button */}
      <button
        onClick={handleMinus}
        disabled={isFutureDay || quantity <= 0}
        className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border text-foreground hover:bg-card disabled:opacity-30 transition-opacity"
      >
        <Minus size={18} />
      </button>

      {/* Quantity display / edit */}
      {editing ? (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={(e) => { if (e.key === "Enter") handleEditSubmit(); }}
          className="w-12 h-11 text-center text-lg font-semibold bg-card rounded-xl border border-primary outline-none text-foreground"
        />
      ) : (
        <button
          onClick={() => { if (!isFutureDay) { setEditValue(String(quantity)); setEditing(true); } }}
          disabled={isFutureDay}
          className="w-12 h-11 text-center text-lg font-semibold text-foreground"
        >
          {quantity}
        </button>
      )}

      {/* Plus button */}
      <button
        onClick={handlePlus}
        disabled={isFutureDay}
        className="flex h-11 min-h-[44px] px-3 items-center justify-center rounded-xl border border-[#BFA37A] text-[#BFA37A] font-medium hover:bg-[#BFA37A]/10 disabled:opacity-30 transition-opacity"
      >
        +1
      </button>

      {/* Recorded feedback */}
      {recorded && (
        <span className="text-xs text-muted-foreground animate-pulse">{t("reduce.recorded")}</span>
      )}
    </div>
  );
}
