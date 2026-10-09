"use client";

import { useState, useEffect } from "react";
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  PackageCheck,
  DollarSign,
  Tag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { InventoryItem } from "@/lib/inventory";

export function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    category: "Medication",
    unit: "Tablet",
    strength: "",
    dosageForm: "Oral",
    unitPrice: 0,
    defaultFrequency: "TDS (3x daily)",
    defaultDuration: "5 days",
    stockQuantity: 100,
    isAvailable: true,
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedCategory !== "all") params.set("category", selectedCategory);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [query, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      name: "",
      category: "Medication",
      unit: "Tablet",
      strength: "",
      dosageForm: "Oral",
      unitPrice: 500,
      defaultFrequency: "TDS (3x daily)",
      defaultDuration: "5 days",
      stockQuantity: 100,
      isAvailable: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit || "Tablet",
      strength: item.strength || "",
      dosageForm: item.dosageForm || "Oral",
      unitPrice: item.unitPrice,
      defaultFrequency: item.defaultFrequency || "TDS (3x daily)",
      defaultDuration: item.defaultDuration || "5 days",
      stockQuantity: item.stockQuantity || 100,
      isAvailable: item.isAvailable,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Item name is required");
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingItem);
      const url = isEdit ? `/api/inventory/${editingItem?.id}` : "/api/inventory";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success(isEdit ? "Item updated successfully!" : "New item added to inventory!");
        setModalOpen(false);
        fetchInventory();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save item");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving inventory item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/${deletingItem.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Item deleted from inventory");
        setDeletingItem(null);
        fetchInventory();
      } else {
        toast.error("Failed to delete item");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Hospital Pharmacy &amp; Price List
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Pill className="h-6 w-6 text-brand-green" /> Inventory &amp; Pricing (NGN ₦)
          </h1>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-brand-green hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
        >
          <Plus className="h-4 w-4" /> Add Drug / Hospital Item
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
          {["all", "Medication", "Consumable", "Injection", "Service"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All Items" : cat}
            </button>
          ))}
        </div>

        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drugs, strengths, or items..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Inventory Items Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand-green" /> Loading hospital inventory...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-50 text-brand-green" />
            <p className="font-semibold text-foreground">No inventory items found</p>
            <p className="mt-1">Click &quot;Add Drug / Hospital Item&quot; to add a new item.</p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">ITEM NAME &amp; STRENGTH</th>
                    <th className="p-3">CATEGORY</th>
                    <th className="p-3">UNIT PRICE (NGN ₦)</th>
                    <th className="p-3">SUGGESTED DOSAGE</th>
                    <th className="p-3">STOCK</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground text-xs">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {item.strength && <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{item.strength}</span>}
                          {item.unit && <span>· {item.unit}</span>}
                          {item.dosageForm && <span>({item.dosageForm})</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-[11px] font-medium">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                        ₦{item.unitPrice.toLocaleString("en-NG")}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {item.defaultFrequency && (
                          <div className="text-[11px]">
                            <strong className="text-foreground">{item.defaultFrequency}</strong> for {item.defaultDuration || "5 days"}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-foreground text-xs tabular-nums">
                          {item.stockQuantity ?? 100} units
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(item)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Edit Item"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingItem(item)}
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                            title="Delete Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD LIST */}
            <ul className="flex flex-col gap-3 p-3 md:hidden">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-background p-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground text-sm truncate">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {item.strength && <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{item.strength}</span>}
                        {item.unit && <span>· {item.unit}</span>}
                        {item.dosageForm && <span>({item.dosageForm})</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-medium shrink-0">
                      {item.category}
                    </Badge>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-base tabular-nums">
                      ₦{item.unitPrice.toLocaleString("en-NG")}
                    </span>
                    <span className="font-semibold text-foreground text-xs tabular-nums shrink-0">
                      {item.stockQuantity ?? 100} units
                    </span>
                  </div>

                  {item.defaultFrequency && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">{item.defaultFrequency}</strong> for {item.defaultDuration || "5 days"}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(item)}
                      className="h-7 text-[11px] gap-1"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingItem(item)}
                      className="h-7 text-[11px] gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Add / Edit Item Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Pill className="h-5 w-5 text-brand-green" />
              {editingItem ? "Edit Hospital Item & Price" : "Add New Drug / Hospital Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs pt-2">
            <div>
              <Label className="text-xs font-semibold">Item Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Paracetamol 500mg, Coartem, IV Saline"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Medication">Medication</option>
                  <option value="Consumable">Consumable / Supply</option>
                  <option value="Injection">Injection / IV</option>
                  <option value="Service">Hospital Service</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Unit Price in NGN (₦) *</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
                  placeholder="Price in Naira ₦"
                  className="mt-1 h-9 text-xs font-bold text-emerald-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Strength</Label>
                <Input
                  value={form.strength}
                  onChange={(e) => setForm({ ...form, strength: e.target.value })}
                  placeholder="e.g. 500mg"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Unit</Label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Pack">Pack</option>
                  <option value="Bag">Bag</option>
                  <option value="Piece">Piece</option>
                  <option value="Pair">Pair</option>
                  <option value="Vial">Vial</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Form</Label>
                <Input
                  value={form.dosageForm}
                  onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                  placeholder="e.g. Oral / IV"
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Suggested Frequency</Label>
                <Input
                  value={form.defaultFrequency}
                  onChange={(e) => setForm({ ...form, defaultFrequency: e.target.value })}
                  placeholder="e.g. TDS (3x daily)"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Suggested Duration</Label>
                <Input
                  value={form.defaultDuration}
                  onChange={(e) => setForm({ ...form, defaultDuration: e.target.value })}
                  placeholder="e.g. 5 days"
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-brand-green hover:bg-emerald-700 text-white font-semibold gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Modal */}
      <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400">
              Delete Inventory Item
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-2">
            <p>
              Are you sure you want to delete <strong className="text-foreground">{deletingItem?.name}</strong> from hospital pricing?
            </p>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingItem(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={handleDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Item
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
