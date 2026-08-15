"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select, 
  Modal, 
  LoadingSpinner,
  SearchBar,
  StatusBadge
} from "@/components/ui/reusable";
import { 
  DollarSign, 
  TrendingDown, 
  Database, 
  Plus, 
  Check, 
  User, 
  Calendar, 
  Building,
  ArrowRightLeft,
  ClipboardList
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function FinanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ledger" | "logs" | "settlements">("ledger");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Finance states
  const [shops, setShops] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [reserves, setReserves] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [partnerBreakdown, setPartnerBreakdown] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalCollected: 0,
    totalExpenses: 0,
    totalReserves: 0,
    remaining: 0,
    partnerShare: 0
  });

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  // Modals state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);

  // Active item state
  const [selectedShop, setSelectedShop] = useState<any | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
    paid_by: "Company"
  });
  const [reserveForm, setReserveForm] = useState({
    amount: "",
    held_by: "Company",
    notes: ""
  });
  const [settlementForm, setSettlementForm] = useState({
    amount: "",
    partner_name: "Sathish",
    settlement_date: new Date().toISOString().split("T")[0],
    notes: ""
  });
  const [collectForm, setCollectForm] = useState({
    amount: "5000",
    billing_date: new Date().toISOString().split("T")[0],
    payment_status: "Pending"
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFinanceData = async () => {
    try {
      const res = await fetch("/api/super-admin/finance");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setShops(data.shops || []);
      setExpenses(data.expenses || []);
      setReserves(data.reserves || []);
      setSettlements(data.settlements || []);
      setPartnerBreakdown(data.partnerBreakdown || []);
      setSummary(data.summary || {
        totalCollected: 0,
        totalExpenses: 0,
        totalReserves: 0,
        remaining: 0,
        partnerShare: 0
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      // Determine if current user is super admin to allow edit override
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const role = user.app_metadata?.role || user.user_metadata?.role;
          if (role === "super_admin") {
            setIsSuperAdmin(true);
          } else {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();
            if (profile?.role === "super_admin") {
              setIsSuperAdmin(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      }

      await fetchFinanceData();
      setLoading(false);
    };
    init();
  }, []);

  const openCollectModal = (shop: any) => {
    setSelectedShop(shop);
    setCollectForm({
      amount: shop.billed_amount.toString(),
      billing_date: new Date().toISOString().split("T")[0],
      payment_status: shop.payment_status === "Collected" ? "Collected" : "Pending"
    });
    setCollectModalOpen(true);
  };

  const handleMarkCollected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/super-admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_collected",
          shop_id: selectedShop.id,
          amount: parseFloat(collectForm.amount),
          billing_date: collectForm.billing_date,
          payment_status: collectForm.payment_status
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setCollectModalOpen(false);
      setSelectedShop(null);
      await fetchFinanceData();
    } catch (err: any) {
      alert(`Failed to update collection: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditExpenseModal = (exp: any) => {
    setSelectedExpense(exp);
    setExpenseForm({
      amount: exp.amount.toString(),
      description: exp.description,
      expense_date: exp.expense_date,
      paid_by: exp.paid_by
    });
    setExpenseModalOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch("/api/super-admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedExpense ? "edit_expense" : "add_expense",
          id: selectedExpense?.id,
          amount: expenseForm.amount,
          description: expenseForm.description,
          expense_date: expenseForm.expense_date,
          paid_by: expenseForm.paid_by
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setExpenseForm({
        amount: "",
        description: "",
        expense_date: new Date().toISOString().split("T")[0],
        paid_by: "Company"
      });
      setSelectedExpense(null);
      setExpenseModalOpen(false);
      await fetchFinanceData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log expense");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch("/api/super-admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_reserve",
          amount: reserveForm.amount,
          held_by: reserveForm.held_by,
          notes: reserveForm.notes
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setReserveForm({
        amount: "",
        held_by: "Company",
        notes: ""
      });
      setReserveModalOpen(false);
      await fetchFinanceData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log reserve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch("/api/super-admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_settlement",
          amount: settlementForm.amount,
          partner_name: settlementForm.partner_name,
          settlement_date: settlementForm.settlement_date,
          notes: settlementForm.notes
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSettlementForm({
        amount: "",
        partner_name: "Sathish",
        settlement_date: new Date().toISOString().split("T")[0],
        notes: ""
      });
      setSettlementModalOpen(false);
      await fetchFinanceData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log payout");
    } finally {
      setActionLoading(false);
    }
  };

  const getEditableCollection = (shop: any) => {
    if (shop.payment_status !== "Collected" || !shop.collections_history) return null;
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const currentColl = shop.collections_history.find((c: any) => {
      const billingMonth = new Date(c.billing_date).toISOString().slice(0, 7);
      return billingMonth === currentMonthStr;
    });
    if (!currentColl) return null;
    if (isSuperAdmin) return currentColl; // Always editable for Super Admin
    
    const timeDiffMs = Date.now() - new Date(currentColl.created_at).getTime();
    const minutesDiff = timeDiffMs / (1000 * 60);
    return minutesDiff <= 10 ? currentColl : null;
  };

  const filteredShops = shops.filter((shop) => {
    const matchesSearch = shop.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          shop.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPayment = !paymentFilter || shop.payment_status === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Billing & Finance Ledger"
        description="Track shop subscription payments, log company expenses, set aside reserve buffers, and record settled payouts."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExpenseModalOpen(true)} className="flex items-center space-x-2 border-slate-300">
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Log Expense</span>
            </Button>
            <Button variant="outline" onClick={() => setReserveModalOpen(true)} className="flex items-center space-x-2 border-slate-300">
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Allocate Reserve</span>
            </Button>
            <Button onClick={() => setSettlementModalOpen(true)} className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Settle Payout</span>
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Aggregated KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center space-x-4 shadow-sm">
              <div className="bg-blue-50 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collected Income</p>
                <p className="text-xl font-bold mt-1 text-primary">₹{summary.totalCollected.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center space-x-4 shadow-sm">
              <div className="bg-red-50 p-3 rounded-xl">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Expenses</p>
                <p className="text-xl font-bold mt-1 text-primary">₹{summary.totalExpenses.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center space-x-4 shadow-sm">
              <div className="bg-amber-50 p-3 rounded-xl">
                <Database className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Held in Reserves</p>
                <p className="text-xl font-bold mt-1 text-primary">₹{summary.totalReserves.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <div className="bg-gradient-to-tr from-accent/10 to-accent/5 p-5 rounded-2xl border border-accent/20 flex items-center space-x-4 shadow-sm">
              <div className="bg-accent/20 p-3 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Dividable Profit</p>
                <p className="text-xl font-bold mt-1 text-accent-foreground">₹{summary.remaining.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>

          {/* Partner Share Cards */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Partner Distribution Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(partnerBreakdown.length > 0 ? partnerBreakdown : [
                { name: "Sathish", allocated: 0, settled: 0, pending: 0 },
                { name: "Sankar", allocated: 0, settled: 0, pending: 0 },
                { name: "Nipin", allocated: 0, settled: 0, pending: 0 }
              ]).map((partner) => (
                <div key={partner.name} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden space-y-4">
                  <div className="absolute top-0 right-0 bg-accent/15 px-3 py-1 rounded-bl-lg text-[9px] font-bold text-accent-foreground uppercase tracking-widest">
                    Partner
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="bg-slate-100 p-2 rounded-lg">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <span className="font-semibold text-primary">{partner.name}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Allocated</p>
                      <p className="text-sm font-semibold text-slate-800">₹{partner.allocated.toLocaleString("en-IN")}</p>
                      {partner.outOfPocket > 0 && (
                        <p className="text-[9px] text-accent-foreground font-bold font-mono mt-0.5">
                          +₹{partner.outOfPocket} Out-of-Pocket
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] text-green-600 font-bold uppercase">Settled</p>
                      <p className="text-sm font-semibold text-green-700">₹{partner.settled.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-amber-600 font-bold uppercase">Pending</p>
                      <p className="text-sm font-bold text-accent-foreground">₹{partner.pending.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table Tabs */}
          <div className="flex space-x-4 border-b border-slate-200">
            <button 
              onClick={() => setActiveTab("ledger")}
              className={`pb-3 text-sm font-semibold tracking-wide transition-all ${
                activeTab === "ledger" 
                  ? "border-b-2 border-accent text-primary" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Subscription Ledger
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`pb-3 text-sm font-semibold tracking-wide transition-all ${
                activeTab === "logs" 
                  ? "border-b-2 border-accent text-primary" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Expenses & Reserves Logs
            </button>
            <button 
              onClick={() => setActiveTab("settlements")}
              className={`pb-3 text-sm font-semibold tracking-wide transition-all ${
                activeTab === "settlements" 
                  ? "border-b-2 border-accent text-primary" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Settlements Log
            </button>
          </div>

          {/* Ledger Tab Content */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              {/* Search Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search shop name or owner..." />
                <div className="w-48">
                  <Select 
                    value={paymentFilter} 
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    options={[
                      { label: "Status: All", value: "" },
                      { label: "Waiting for Payment", value: "Pending" },
                      { label: "Collected", value: "Collected" }
                    ]} 
                  />
                </div>
              </div>

              {/* Table */}
              <Table headers={["Onboard Date", "Owner Name", "Shop Name", "Location", "Subscription", "Renewal Date", "Billed Amount", "Collection Status", "Actions"]}>
                {filteredShops.map((shop) => {
                  const editableColl = getEditableCollection(shop);

                  return (
                    <tr key={shop.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        {shop.created_at ? new Date(shop.created_at).toLocaleDateString("en-IN") : "N/A"}
                      </td>
                      <td className="py-4 px-6 font-medium text-primary">{shop.owner_name}</td>
                      <td className="py-4 px-6 font-semibold text-primary">{shop.name}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">{shop.location}</td>
                      <td className="py-4 px-6 font-medium text-slate-600 capitalize">{shop.subscription_plan}</td>
                      <td className="py-4 px-6 text-slate-600 text-xs font-mono">
                        {shop.renewal_date ? new Date(shop.renewal_date).toLocaleDateString("en-IN") : "N/A"}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-700">₹{shop.billed_amount.toLocaleString("en-IN")}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          shop.payment_status === "Collected" 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {shop.payment_status === "Collected" ? "Collected" : "Waiting for Payment"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {shop.payment_status !== "Collected" ? (
                          <button 
                            onClick={() => openCollectModal(shop)}
                            disabled={actionLoading}
                            className="flex items-center space-x-1 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1 rounded-lg text-xs font-semibold border border-green-200 transition-all duration-200"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Collected</span>
                          </button>
                        ) : editableColl ? (
                          <button 
                            onClick={() => openCollectModal(shop)}
                            disabled={actionLoading}
                            className="text-xs font-bold text-accent-foreground hover:underline"
                          >
                            {isSuperAdmin ? "Edit (Override)" : `Edit (${Math.ceil(10 - (Date.now() - new Date(editableColl.created_at).getTime()) / (1000 * 60))}m left)`}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold italic">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </div>
          )}

          {/* Logs Tab Content */}
          {activeTab === "logs" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expenses Logs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold tracking-wide text-primary flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span>Company Expenses</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Description</th>
                        <th className="pb-3">Paid By</th>
                        <th className="pb-3">Logged By</th>
                        <th className="pb-3 text-right">Amount</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="pt-4 text-slate-400 text-center italic">No expenses logged yet.</td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 text-slate-500 font-mono">
                              {new Date(exp.expense_date).toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-3 font-semibold text-slate-700">{exp.description}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                exp.paid_by !== "Company" ? "bg-accent/15 text-accent-foreground border border-accent/20" : "bg-slate-100 text-slate-600"
                              }`}>
                                {exp.paid_by === "Company" ? "Company Account" : exp.paid_by}
                              </span>
                            </td>
                            <td className="py-3 text-slate-500">
                              {exp.profiles?.name || "System"}
                            </td>
                            <td className="py-3 text-right font-bold text-slate-800">₹{parseFloat(exp.amount).toLocaleString("en-IN")}</td>
                            <td className="py-3 text-right">
                              <button 
                                onClick={() => openEditExpenseModal(exp)}
                                className="text-[10px] font-bold text-accent-foreground hover:underline"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reserves Logs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold tracking-wide text-primary flex items-center space-x-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  <span>Reserves Allocation Ledger</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Notes</th>
                        <th className="pb-3">Held By</th>
                        <th className="pb-3">Logged By</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reserves.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="pt-4 text-slate-400 text-center italic">No reserves allocated yet.</td>
                        </tr>
                      ) : (
                        reserves.map((res) => (
                          <tr key={res.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 text-slate-500 font-mono">
                              {new Date(res.created_at).toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-3 text-slate-700">{res.notes || "Company Buffer"}</td>
                            <td className="py-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                                {res.held_by}
                              </span>
                            </td>
                            <td className="py-3 text-slate-500">
                              {res.profiles?.name || "System"}
                            </td>
                            <td className="py-3 text-right font-bold text-slate-800">₹{parseFloat(res.amount).toLocaleString("en-IN")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settlements Tab Content */}
          {activeTab === "settlements" && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold tracking-wide text-primary flex items-center space-x-2">
                <ClipboardList className="w-4 h-4 text-accent-foreground" />
                <span>Partner Payout Logs (Immoutable)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Partner Name</th>
                      <th className="pb-3">Notes</th>
                      <th className="pb-3">Logged By</th>
                      <th className="pb-3 text-right">Amount Settled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="pt-4 text-slate-400 text-center italic">No settlements logged yet.</td>
                      </tr>
                    ) : (
                      settlements.map((set) => (
                        <tr key={set.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 text-slate-500 font-mono">
                            {new Date(set.settlement_date).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-3 font-semibold text-primary">{set.partner_name}</td>
                          <td className="py-3 text-slate-600">{set.notes || "Regular Share Settlement"}</td>
                          <td className="py-3 text-slate-500">
                            {set.profiles?.name || "System"}
                          </td>
                          <td className="py-3 text-right font-bold text-green-700">₹{parseFloat(set.amount).toLocaleString("en-IN")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add Expense Modal */}
          <Modal isOpen={expenseModalOpen} onClose={() => { setExpenseModalOpen(false); setSelectedExpense(null); setExpenseForm({ amount: "", description: "", expense_date: new Date().toISOString().split("T")[0], paid_by: "Company" }); }} title={selectedExpense ? "Edit Expense" : "Log Company Expense"}>
            <form onSubmit={handleAddExpense} className="space-y-4">
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Expense Date</label>
                <Input 
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Description</label>
                <Input 
                  type="text"
                  placeholder="e.g. Hostinger VPS server renewal, Cloudflare API..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Who Paid for this Expense?</label>
                <Select 
                  value={expenseForm.paid_by}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, paid_by: e.target.value }))}
                  options={[
                    { label: "Company Account", value: "Company" },
                    { label: "Sathish (Out-of-Pocket)", value: "Sathish" },
                    { label: "Sankar (Out-of-Pocket)", value: "Sankar" },
                    { label: "Nipin (Out-of-Pocket)", value: "Nipin" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Amount (₹)</label>
                <Input 
                  type="number"
                  placeholder="Amount in Rupees"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <Button variant="outline" type="button" onClick={() => setExpenseModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Logging..." : "Log Expense"}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Add Reserve Modal */}
          <Modal isOpen={reserveModalOpen} onClose={() => setReserveModalOpen(false)} title="Allocate Reserves">
            <form onSubmit={handleAddReserve} className="space-y-4">
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Who Holds the Reserve?</label>
                <Select 
                  value={reserveForm.held_by}
                  onChange={(e) => setReserveForm(prev => ({ ...prev, held_by: e.target.value }))}
                  options={[
                    { label: "Sathish", value: "Sathish" },
                    { label: "Sankar", value: "Sankar" },
                    { label: "Nipin", value: "Nipin" },
                    { label: "Company (Aurum Account)", value: "Company" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Notes / Reason</label>
                <Input 
                  type="text"
                  placeholder="e.g. Emergency server fund, Q3 Buffer..."
                  value={reserveForm.notes}
                  onChange={(e) => setReserveForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Amount (₹)</label>
                <Input 
                  type="number"
                  placeholder="Amount in Rupees"
                  value={reserveForm.amount}
                  onChange={(e) => setReserveForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <Button variant="outline" type="button" onClick={() => setReserveModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Allocating..." : "Allocate Reserve"}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Add Settlement Modal */}
          <Modal isOpen={settlementModalOpen} onClose={() => setSettlementModalOpen(false)} title="Settle Partner Payout">
            <form onSubmit={handleAddSettlement} className="space-y-4">
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Partner</label>
                <Select 
                  value={settlementForm.partner_name}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, partner_name: e.target.value }))}
                  options={[
                    { label: "Sathish", value: "Sathish" },
                    { label: "Sankar", value: "Sankar" },
                    { label: "Nipin", value: "Nipin" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Settlement Date</label>
                <Input 
                  type="date"
                  value={settlementForm.settlement_date}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, settlement_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Notes</label>
                <Input 
                  type="text"
                  placeholder="e.g. August Share Transfer, GPay..."
                  value={settlementForm.notes}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Amount (₹)</label>
                <Input 
                  type="number"
                  placeholder="Amount to settle"
                  value={settlementForm.amount}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <Button variant="outline" type="button" onClick={() => setSettlementModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Settling..." : "Log Settlement"}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Record Collection Modal */}
          <Modal isOpen={collectModalOpen} onClose={() => setCollectModalOpen(false)} title={`Record Collection: ${selectedShop?.name || ""}`}>
            <form onSubmit={handleMarkCollected} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Billing Date</label>
                <Input 
                  type="date"
                  value={collectForm.billing_date}
                  onChange={(e) => setCollectForm(prev => ({ ...prev, billing_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Payment Status</label>
                <Select 
                  value={collectForm.payment_status}
                  onChange={(e) => setCollectForm(prev => ({ ...prev, payment_status: e.target.value }))}
                  options={[
                    { label: "Waiting for Payment", value: "Pending" },
                    { label: "Collected", value: "Collected" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Exact Amount Collected / Expected (₹)</label>
                <Input 
                  type="number"
                  value={collectForm.amount}
                  onChange={(e) => setCollectForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <Button variant="outline" type="button" onClick={() => setCollectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Recording..." : "Record Status"}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
