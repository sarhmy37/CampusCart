import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal, ImageBackground,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  Wallet, Landmark, Trash2, X, Eye, EyeOff, ChevronUp, ChevronDown,
} from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { BALANCE_DARK_IMAGE, BALANCE_LIGHT_IMAGE } from '@/data/media';
import ModalPicker from '@/components/ModalPicker';
import { SkeletonList, ErrorState } from './shared';
import { useColors } from '@/hooks/useColors';

const FALLBACK_GHS_TO_USD_RATE = 0.067;

const money = (n: number | string) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MOBILE_MONEY_NETWORKS = [
  { code: 'MTN', name: 'MTN Mobile Money' },
  { code: 'VOD', name: 'Vodafone Cash / Telecel Cash' },
  { code: 'AT', name: 'AirtelTigo Money' },
];

export default function Payouts({ period, active }: { period: string; active?: boolean }) {
  const colors = useColors();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [banks, setBanks] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      api.get('/payouts/accounts'),
      api.get('/payouts/balance'),
    ])
      .then(([accRes, balRes]) => {
        setAccounts(accRes.data || []);
        setBalance(balRes.data.availableBalance || 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (active) load(); }, [active]);

  useEffect(() => {
    api.get('/payouts/banks').then((res) => setBanks(res.data || [])).catch(() => {});
  }, []);

  const [ghsToUsdRate, setGhsToUsdRate] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/GHS')
      .then((res) => res.json())
      .then((data) => {
        const rate = data?.rates?.USD;
        setGhsToUsdRate(typeof rate === 'number' ? rate : FALLBACK_GHS_TO_USD_RATE);
      })
      .catch(() => setGhsToUsdRate(FALLBACK_GHS_TO_USD_RATE));
  }, []);
  useEffect(() => {
    api.get('/sellers/overview', { params: { period } })
      .then((res) => {
        const raw = res.data?.net_change_percentage;
        setChangePct(raw !== undefined && raw !== null ? parseFloat(raw) : null);
      })
      .catch(() => setChangePct(null));
  }, [period]);

  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [balancePassword, setBalancePassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const handleToggleBalance = () => {
    if (balanceRevealed) { setBalanceRevealed(false); return; }
    setBalancePassword('');
    setShowPasswordModal(true);
  };
  const handleVerifyPassword = async () => {
    if (!balancePassword) return Toast.show({ type: 'error', text1: 'Enter your password' });
    setVerifyingPassword(true);
    try {
      await api.post('/auth/me/verify-password', { password: balancePassword });
      setBalanceRevealed(true);
      setShowPasswordModal(false);
      setBalancePassword('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Incorrect password' });
    } finally {
      setVerifyingPassword(false);
    }
  };

  const [selectedAccountId, setSelectedAccountId] = useState<any>('');
  useEffect(() => {
    const def = accounts.find((a) => a.is_default);
    if (def && !selectedAccountId) setSelectedAccountId(def.id);
  }, [accounts]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdrawClick = () => {
    if (!selectedAccountId) return Toast.show({ type: 'error', text1: 'Please select a payout account' });
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return Toast.show({ type: 'error', text1: 'Please enter a valid amount' });
    if (amount > balance) return Toast.show({ type: 'error', text1: 'Amount exceeds available balance' });
    setShowWithdrawConfirm(true);
  };
  const handleConfirmWithdraw = async () => {
    if (!withdrawPassword) return Toast.show({ type: 'error', text1: 'Enter your password to confirm' });
    const amount = parseFloat(withdrawAmount);
    setWithdrawing(true);
    try {
      await api.post('/payouts/withdraw', {
        accountId: selectedAccountId,
        amountGHS: amount,
        password: withdrawPassword,
      });
      Toast.show({ type: 'success', text1: `Successfully requested withdrawal of GHS ${money(amount)}!` });
      setWithdrawAmount(''); setWithdrawPassword(''); setShowWithdrawConfirm(false);
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Withdrawal failed' });
    } finally {
      setWithdrawing(false);
    }
  };

  const [settingDefault, setSettingDefault] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<any>(null);
  const pendingDeleteTimer = useRef<any>(null);
  const DELETE_WINDOW_MS = 4000;

  const handleSetDefault = async (id: any) => {
    setSettingDefault(id);
    try {
      await api.patch(`/payouts/default/${id}`);
      Toast.show({ type: 'success', text1: 'Default payout account updated' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to update default' });
    } finally {
      setSettingDefault(null);
    }
  };
  const handleDeleteClick = (id: any) => {
    if (pendingDeleteId === id) {
      clearTimeout(pendingDeleteTimer.current);
      setPendingDeleteId(null);
      (async () => {
        setDeletingId(id);
        try {
          await api.delete(`/payouts/accounts/${id}`);
          Toast.show({ type: 'success', text1: 'Payout account deleted' });
          load();
        } catch (err: any) {
          Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to delete account' });
        } finally {
          setDeletingId(null);
        }
      })();
      return;
    }
    setPendingDeleteId(id);
    Toast.show({ type: 'info', text1: 'Tap again to delete permanently' });
    clearTimeout(pendingDeleteTimer.current);
    pendingDeleteTimer.current = setTimeout(() => setPendingDeleteId(null), DELETE_WINDOW_MS);
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [method, setMethod] = useState<'bank' | 'mobile_money'>('bank');
  const [form, setForm] = useState({ bank_code: '', account_number: '', account_name: '' });
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [accountTaken, setAccountTaken] = useState(false);

  useEffect(() => {
    if (!form.bank_code || form.account_number.length < 9) return;
    setResolving(true);
    const t = setTimeout(() => {
      api.post('/payouts/resolve-account', { bank_code: form.bank_code, account_number: form.account_number })
        .then((res) => setForm((f) => ({ ...f, account_name: res.data.account_name })))
        .catch(() => setForm((f) => ({ ...f, account_name: '' })))
        .finally(() => setResolving(false));
    }, 500);
    return () => clearTimeout(t);
  }, [form.bank_code, form.account_number]);

  useEffect(() => {
    setAccountTaken(false);
    if (!form.bank_code || form.account_number.length < 9) return;
    const t = setTimeout(() => {
      api.get('/payouts/check-account', { params: { bank_code: form.bank_code, account_number: form.account_number } })
        .then((res) => setAccountTaken(!!res.data.taken))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [form.bank_code, form.account_number]);

  const handleAddAccount = async () => {
    if (accountTaken) {
      return Toast.show({ type: 'error', text1: 'An account with this number already exists.' });
    }
    if (!form.bank_code || !form.account_number || !form.account_name) {
      return Toast.show({ type: 'error', text1: 'Please fill in all fields' });
    }
    setSaving(true);
    try {
      await api.post('/payouts/accounts', { ...form, method });
      Toast.show({ type: 'success', text1: 'Account added successfully' });
      setShowAddModal(false);
      setForm({ bank_code: '', account_number: '', account_name: '' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to add account' });
    } finally {
      setSaving(false);
    }
  };

  const [withdrawalsTab, setWithdrawalsTab] = useState<'requests' | 'completed'>('requests');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [reportingId, setReportingId] = useState<any>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadWithdrawals = () => {
    setLoadingWithdrawals(true);
    api.get('/payouts/withdrawals').then((res) => setWithdrawals(res.data || [])).catch(() => {}).finally(() => setLoadingWithdrawals(false));
  };
  useEffect(loadWithdrawals, []);

  const requestWithdrawals = withdrawals.filter((w) => w.status !== 'completed');
  const completedWithdrawals = withdrawals.filter((w) => w.status === 'completed');

  const handleSubmitReport = async (id: any) => {
    setSubmittingReport(true);
    try {
      await api.post(`/payouts/withdrawals/${id}/report`, { message: reportMessage });
      Toast.show({ type: 'success', text1: 'Report submitted' });
      setReportingId(null); setReportMessage('');
      loadWithdrawals();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to submit report' });
    } finally {
      setSubmittingReport(false);
    }
  };

  const balanceBg = theme === 'dark' ? BALANCE_DARK_IMAGE : BALANCE_LIGHT_IMAGE;

  const inputStyle = {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, fontSize: 14, color: colors.text,
    backgroundColor: colors.inputBg,
  };
  const primaryBtn = {
    paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand,
    alignItems: 'center' as const,
  };

  if (loading) return <SkeletonList />;
  if (error) return <ErrorState icon={Wallet} text="Couldn't load your payout info right now." onRetry={load} />;

  return (
    <View style={{ gap: 16 }}>
      {/* BALANCE CARD */}
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <ImageBackground source={balanceBg} style={{ padding: 24 }} imageStyle={{ borderRadius: 16 }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Available Balance</Text>
                <Pressable onPress={handleToggleBalance}>
                  {balanceRevealed ? <EyeOff size={14} color="rgba(255,255,255,0.8)" /> : <Eye size={14} color="rgba(255,255,255,0.8)" />}
                </Pressable>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: 'white', marginTop: 6 }}>
                {balanceRevealed ? `GHS ${money(balance)}` : 'GHS ••••••'}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {isPlanActive ? '100% of your completed sales' : '98.5% of your completed sales'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: 0.5 }}>USD</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: 'white', marginTop: 6 }}>
                {!balanceRevealed ? '$••.••' : ghsToUsdRate !== null ? `$${money(balance * ghsToUsdRate)}` : '—'}
              </Text>
              {changePct !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                  {changePct >= 0 ? <ChevronUp size={12} color="#6ee7b7" /> : <ChevronDown size={12} color="#fca5a5" />}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: changePct >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                    {Math.abs(changePct).toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* WITHDRAW FUNDS */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={16} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Withdraw Funds</Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>Select Payout Account</Text>
        <ModalPicker
          value={selectedAccountId}
          onSelect={setSelectedAccountId}
          placeholder="Select an account"
          options={accounts.map((a) => ({
            label: `${a.account_name} (${a.bank_name || a.method})${a.is_default ? ' ⭐' : ''}`,
            value: a.id,
          }))}
        />

        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Amount (GHS)</Text>
        <TextInput
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          style={inputStyle}
        />

        <Pressable
          onPress={handleWithdrawClick}
          disabled={withdrawing || balance <= 0 || !selectedAccountId}
          style={[primaryBtn, { marginTop: 16, opacity: withdrawing || balance <= 0 || !selectedAccountId ? 0.5 : 1 }]}
        >
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
            {withdrawing ? 'Processing...' : 'Withdraw Funds'}
          </Text>
        </Pressable>

        {!user?.verified && (
          <Text style={{ fontSize: 12, color: colors.error, textAlign: 'center', marginTop: 8 }}>
            ⚠️ Verify your account to enable withdrawals.
          </Text>
        )}
      </View>

      {/* SAVED ACCOUNTS */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={16} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Saved Payout Accounts</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 16 }}>
          These are the accounts you can withdraw your earnings to.
        </Text>

        {accounts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontSize: 14, color: colors.textFaint }}>No payout account set up yet.</Text>
            <Pressable onPress={() => setShowAddModal(true)} style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand }}>+ Add payout account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {accounts.map((acc) => (
              <View key={acc.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: acc.is_default ? colors.brand : colors.border, backgroundColor: acc.is_default ? colors.brandSoft : colors.card }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{acc.account_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    {acc.bank_name || acc.method} · •••• {acc.account_number.slice(-4)}
                  </Text>
                  {acc.is_default && <Text style={{ fontSize: 10, fontWeight: '700', color: colors.brand, marginTop: 2 }}>Default</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {!acc.is_default && (
                    <Pressable onPress={() => handleSetDefault(acc.id)} disabled={settingDefault === acc.id}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>
                        {settingDefault === acc.id ? 'Setting…' : 'Set as default'}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => handleDeleteClick(acc.id)} disabled={deletingId === acc.id} style={{ padding: 6, borderRadius: 8, backgroundColor: pendingDeleteId === acc.id ? colors.errorSoft : 'transparent' }}>
                    <Trash2 size={16} color={pendingDeleteId === acc.id ? colors.error : colors.textFaint} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable onPress={() => setShowAddModal(true)} style={{ marginTop: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textFaint, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand }}>+ Add another account</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* WITHDRAWALS LIST */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, alignSelf: 'center', marginBottom: 16, gap: 4 }}>
          {(['requests', 'completed'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setWithdrawalsTab(t)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: withdrawalsTab === t ? colors.card : 'transparent' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: withdrawalsTab === t ? colors.brand : colors.textMuted }}>
                {t === 'requests' ? 'Withdrawal requests' : 'Completed'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loadingWithdrawals ? (
          <ActivityIndicator color={colors.brand} />
        ) : withdrawalsTab === 'requests' ? (
          requestWithdrawals.length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>
              No pending withdrawal requests.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {requestWithdrawals.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>GHS {money(w.amount)}</Text>
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                      {w.account_name} · {new Date(w.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.warning, textTransform: 'uppercase' }}>{w.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : completedWithdrawals.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>
            No completed withdrawals yet.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {completedWithdrawals.map((w) => (
              <View key={w.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>GHS {parseFloat(w.amount).toFixed(2)}</Text>
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                      {w.account_name} · {new Date(w.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.success, textTransform: 'uppercase' }}>Completed</Text>
                  </View>
                </View>

                {w.reported_at ? (
                  <Text style={{ fontSize: 12, color: colors.error, marginTop: 8 }}>
                    ⚠️ Reported not received on {new Date(w.reported_at).toLocaleDateString()}
                  </Text>
                ) : reportingId === w.id ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <TextInput
                      value={reportMessage}
                      onChangeText={setReportMessage}
                      placeholder="Describe the issue…"
                      placeholderTextColor={colors.textFaint}
                      multiline
                      style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 12, color: colors.text, backgroundColor: colors.inputBg, minHeight: 60, textAlignVertical: 'top' }}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => { setReportingId(null); setReportMessage(''); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={() => handleSubmitReport(w.id)} disabled={submittingReport} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.error, alignItems: 'center', opacity: submittingReport ? 0.6 : 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>{submittingReport ? 'Submitting…' : 'Submit'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setReportingId(w.id)} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error, textDecorationLine: 'underline' }}>Not received?</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* PASSWORD MODAL — reveal balance */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setShowPasswordModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => setShowPasswordModal(false)} style={{ position: 'absolute', top: 16, right: 16 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Confirm it's you</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>Enter your password to view your available balance.</Text>
            <TextInput
              value={balancePassword}
              onChangeText={setBalancePassword}
              placeholder="••••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={[inputStyle, { marginTop: 16 }]}
            />
            <Pressable onPress={handleVerifyPassword} disabled={verifyingPassword} style={[primaryBtn, { marginTop: 16, opacity: verifyingPassword ? 0.6 : 1 }]}>
              <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{verifyingPassword ? 'Verifying…' : 'Show balance'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* WITHDRAW CONFIRM MODAL */}
      <Modal visible={showWithdrawConfirm} transparent animationType="fade" onRequestClose={() => setShowWithdrawConfirm(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setShowWithdrawConfirm(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => setShowWithdrawConfirm(false)} style={{ position: 'absolute', top: 16, right: 16 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Confirm withdrawal</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
              Enter your password to confirm withdrawing GHS {money(withdrawAmount || '0')}.
            </Text>
            <TextInput
              value={withdrawPassword}
              onChangeText={setWithdrawPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={[inputStyle, { marginTop: 16 }]}
            />
            <Pressable onPress={handleConfirmWithdraw} disabled={withdrawing} style={[primaryBtn, { marginTop: 16, opacity: withdrawing ? 0.6 : 1 }]}>
              <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{withdrawing ? 'Processing…' : 'Confirm withdrawal'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ADD ACCOUNT MODAL */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setShowAddModal(false)}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: colors.border }}>
              <Pressable onPress={() => setShowAddModal(false)} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Add payout account</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>Your earnings will be sent here.</Text>

              <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 16, gap: 4 }}>
                {(['bank', 'mobile_money'] as const).map((m) => (
                  <Pressable key={m} onPress={() => { setMethod(m); setForm({ bank_code: '', account_number: '', account_name: '' }); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: method === m ? colors.card : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: method === m ? colors.brand : colors.textMuted }}>
                      {m === 'bank' ? 'Bank' : 'Mobile Money'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 16, marginBottom: 4 }}>
                {method === 'bank' ? 'Bank' : 'Network'}
              </Text>
              <ModalPicker
                value={form.bank_code}
                onSelect={(v) => setForm({ ...form, bank_code: v, account_name: '' })}
                placeholder={`Select ${method === 'bank' ? 'bank' : 'network'}`}
                options={
                  method === 'mobile_money'
                    ? MOBILE_MONEY_NETWORKS.map((n) => ({ label: n.name, value: n.code }))
                    : banks.filter((b) => b.type !== 'mobile_money').map((b) => ({ label: b.name, value: b.code }))
                }
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Account number</Text>
              <TextInput
                value={form.account_number}
                onChangeText={(v) => setForm({ ...form, account_number: v.replace(/\D/g, ''), account_name: '' })}
                placeholder="0123456789"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={inputStyle}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Account name</Text>
              <TextInput
                value={form.account_name}
                onChangeText={(v) => setForm({ ...form, account_name: v.toUpperCase() })}
                placeholder="KWAME ASANTE"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                style={inputStyle}
              />
               {accountTaken && (
                <Text style={{ fontSize: 12, color: colors.error, marginTop: 6 }}>
                  An account with this number already exists. Use a different account.
                </Text>
              )}
              {resolving && <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6 }}>Resolving account name…</Text>}

              <Pressable onPress={handleAddAccount} disabled={saving || !form.account_name || resolving || accountTaken} style={[primaryBtn, { marginTop: 20, opacity: saving || !form.account_name || resolving || accountTaken ? 0.5 : 1 }]}>
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{saving ? 'Adding…' : 'Add account'}</Text>
              </Pressable>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}