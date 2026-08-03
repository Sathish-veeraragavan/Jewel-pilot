"use client";

import React from "react";

// 1. Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center font-semibold transition-all rounded-xl outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-slate-900 focus:ring-primary",
    secondary: "bg-secondary text-white hover:bg-blue-900 focus:ring-secondary",
    accent: "bg-accent text-primary hover:bg-accent-hover focus:ring-accent",
    outline: "border border-border bg-white text-primary hover:bg-slate-50 focus:ring-accent",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// 2. Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1 w-full">
      {label && <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">{label}</label>}
      <input
        className={`w-full px-4 py-3 rounded-xl border ${
          error ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-accent focus:ring-accent"
        } focus:ring-1 outline-none text-sm text-primary transition-all placeholder:text-slate-455 bg-white ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// 3. Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string | number }[];
}

export function Select({ label, error, options, className = "", ...props }: SelectProps) {
  return (
    <div className="space-y-1 w-full">
      {label && <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">{label}</label>}
      <select
        className={`w-full px-4 py-3 rounded-xl border ${
          error ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-accent focus:ring-accent"
        } focus:ring-1 outline-none text-sm text-primary transition-all bg-white ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// 4. Table
interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="w-full overflow-hidden border border-border rounded-2xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-xs font-bold uppercase tracking-wider text-slate-500">
              {headers.map((h, i) => (
                <th key={i} className="py-4 px-6">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm text-primary">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 5. Modal
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-lg text-primary">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors text-lg font-bold">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
      </div>
    </div>
  );
}

// 6. Drawer
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in border-l border-border">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-lg text-primary">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors text-lg font-bold">
            &times;
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// 7. Confirmation Dialog
interface ConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
}: ConfirmProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm border border-border shadow-xl p-6 space-y-4">
        <h3 className="font-bold text-lg text-primary">{title}</h3>
        <p className="text-sm text-slate-500">{message}</p>
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 8. Search Bar
interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search..." }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-xs">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-accent focus:ring-accent focus:ring-1 outline-none text-sm text-primary transition-all placeholder:text-slate-400 bg-white"
      />
    </div>
  );
}

// 9. Status Badge
interface BadgeProps {
  status: "active" | "pending" | "expired" | "suspended" | "cancelled" | "draft" | "processing" | "completed" | "failed";
}

export function StatusBadge({ status }: BadgeProps) {
  const colors = {
    active: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    expired: "bg-red-50 text-red-700 border-red-200",
    suspended: "bg-orange-50 text-orange-700 border-orange-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-300",
    failed: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// 10. Loading Spinner
export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
    </div>
  );
}

// 11. Empty State
interface EmptyProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-border border-dashed rounded-2xl min-h-64">
      <h3 className="font-semibold text-primary text-base">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}

// 12. Page Header
interface HeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-primary">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// 13. Stat Card
interface StatProps {
  title: string;
  value: string | number;
  change?: string;
}

export function StatCard({ title, value, change }: StatProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
      {change && <p className="mt-2 text-xs text-accent font-semibold">{change}</p>}
    </div>
  );
}

// 14. Pagination
interface PaginationProps {
  current: number;
  total: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ current, total, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-slate-500">
        Page <span className="font-semibold text-primary">{current}</span> of <span className="font-semibold text-primary">{total}</span>
      </p>
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={current === total} onClick={() => onPageChange(current + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// 15. Breadcrumb
interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex text-xs font-medium text-slate-400 space-x-2 items-center">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-slate-350">/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-primary transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="text-slate-600 font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
