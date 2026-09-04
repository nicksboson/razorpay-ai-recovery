import React, { useState, useEffect, useRef } from 'react';
import MetricsBar from './components/MetricsBar';
import RunButton from './components/RunButton';
import TransactionTable from './components/TransactionTable';
import AuditTrail from './components/AuditTrail';
import AddTransactionModal from './components/AddTransactionModal';
import { Plus, RotateCcw, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(fetchMetrics, 2000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [isRunning]);

  async function fetchAll() {
    await Promise.all([fetchTransactions(), fetchAuditLogs(), fetchMetrics()]);
  }

  async function fetchTransactions() {
    try {
      const res = await fetch(`${API}/api/transactions`);
      const json = await res.json();
      if (json.success) setTransactions(json.data);
    } catch (e) { console.error('fetchTransactions error:', e); }
  }

  async function fetchAuditLogs() {
    try {
      const res = await fetch(`${API}/api/audit`);
      const json = await res.json();
      if (json.success) setAuditLogs(json.data);
    } catch (e) { console.error('fetchAuditLogs error:', e); }
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(`${API}/api/metrics`);
      const json = await res.json();
      if (json.success) setMetrics(json.data);
    } catch (e) { console.error('fetchMetrics error:', e); }
  }

  async function handleRunBatch() {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch(`${API}/api/recover`, { method: 'POST' });
      const json = await res.json();
      if (json.success) setLastResult(json.data);
      else setError(json.error || 'Batch failed');
    } catch (e) {
      setError('Could not connect to server');
    } finally {
      setIsRunning(false);
      await fetchAll();
    }
  }

  async function handleAddTransaction(form) {
    const res = await fetch(`${API}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    await fetchAll();
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const formattedData = data.map(row => {
          const cleanRow = {};
          for (let key in row) {
            const cleanKey = key.trim().toLowerCase().replace(/ /g, '_');
            cleanRow[cleanKey] = row[key];
          }
          return cleanRow;
        });

        const res = await fetch(`${API}/api/transactions/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: formattedData })
        });
        const json = await res.json();
        
        if (!json.success) throw new Error(json.error);
        await fetchAll();
        alert(`✅ Successfully imported ${json.count} transactions from ${file.name}`);
      } catch (err) {
        setError('Failed to import file: ' + err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  async function handleReset() {
    if (!window.confirm('This will delete ALL current transactions and audit logs from the database. Continue?')) return;
    setIsResetting(true);
    setLastResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/api/seed/reset`, { method: 'POST' });
      const json = await res.json();
      if (json.success) await fetchAll();
      else setError(json.error || 'Reset failed');
    } catch (e) {
      setError('Reset failed — could not connect to server');
    } finally {
      setIsResetting(false);
    }
  }

  const secondaryBtnClass = `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
    bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 
    transition-colors shadow-sm disabled:opacity-50`;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
      {/* ── HEADER ── */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 18L10 4L18 14H12L16 4" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-gray-900 font-extrabold text-lg tracking-tight">Razorpay</span>
            </div>
            <span className="text-gray-300 font-light">|</span>
            <span className="text-gray-500 text-sm tracking-widest uppercase font-semibold">AI Revenue Recovery</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
              ₹{(metrics?.total_at_risk_amount || 0).toLocaleString('en-IN')} at risk
            </span>
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold border
              ${isRunning ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-blue-600 animate-pulse' : 'bg-emerald-500'}`}></span>
              {isRunning ? 'Processing...' : 'Agent Ready'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── METRICS BAR ── */}
        <MetricsBar metrics={metrics} />

        {/* ── ACTION BAR ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <RunButton isRunning={isRunning} onClick={handleRunBatch} />
            {lastResult && !isRunning && (
              <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap font-medium">
                <span className="text-emerald-600 font-bold">✓ Batch complete —</span>
                <span>{lastResult.processed} processed</span>
                <span className="text-emerald-600">{lastResult.recovered} recovered</span>
                <span className="text-amber-600">{lastResult.escalated} escalated</span>
                <span className="text-blue-600">{lastResult.reminder_sent} reminded</span>
                <span className="text-gray-400">in {(lastResult.duration_ms / 1000).toFixed(1)}s</span>
              </div>
            )}
            {error && <p className="text-red-600 text-sm font-semibold">⚠ {error}</p>}
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="file" ref={fileInputRef} onChange={handleFileUpload} 
              accept=".csv, .xlsx, .xls" className="hidden" 
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className={secondaryBtnClass}>
              <Upload size={15} className={isImporting ? 'animate-bounce text-blue-600' : 'text-gray-500'} />
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
            <button onClick={() => setShowAddModal(true)} className={secondaryBtnClass}>
              <Plus size={15} className="text-gray-500" />
              Add Transaction
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button onClick={handleReset} disabled={isResetting} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors disabled:opacity-40">
              <RotateCcw size={14} className={isResetting ? 'animate-spin' : ''} />
              {isResetting ? 'Clearing...' : 'Clear Data'}
            </button>
          </div>
        </div>

        {/* ── TAB SWITCHER ── */}
        <div className="border-b border-gray-200 mt-8">
          <nav className="flex gap-6">
            {[
              { key: 'transactions', label: 'Transactions', count: transactions.length },
              { key: 'audit', label: 'Audit Trail', count: auditLogs.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2
                  ${activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                {tab.label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                  ${activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── TAB CONTENT ── */}
        {activeTab === 'transactions'
          ? <TransactionTable transactions={transactions} />
          : <AuditTrail auditLogs={auditLogs} apiUrl={API} />
        }
      </main>

      {/* ── ADD TRANSACTION MODAL ── */}
      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTransaction}
        />
      )}
    </div>
  );
}
