import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  Wallet, Landmark, Trash2, X, Eye, EyeOff, ChevronUp, ChevronDown,
} from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import ModalPicker from '@/components/ModalPicker';
import { SkeletonList, ErrorState } from './shared';
import { useColors } from '@/hooks/useColors';
import PaystackCheckout from '@/components/PaystackCheckout';

const PAYMENT_CALLBACK_URL = 'https://campuscart-tdfn.onrender.com/paystack/callback';

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
  const [resolveFailed, setResolveFailed] = useState(false);
  const [accountTaken, setAccountTaken] = useState(false);

  useEffect(() => {
    setResolveFailed(false);
    if (!form.bank_code || form.account_number.length < 9) { setResolving(false); return; }
    let cancelled = false;
    setResolving(true);
    const t = setTimeout(() => {
      api.post('/payouts/resolve-account', { bank_code: form.bank_code, account_number: form.account_number })
        .then((res) => { if (!cancelled) setForm((f) => ({ ...f, account_name: res.data.account_name })); })
        .catch(() => { if (!cancelled) { setForm((f) => ({ ...f, account_name: '' })); setResolveFailed(true); } })
        .finally(() => { if (!cancelled) setResolving(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); setResolving(false); };
  }, [form.bank_code, form.account_number]);

  useEffect(() => {
    setAccountTaken(false);
    if (!form.bank_code || form.account_number.length < 9) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.get('/payouts/check-account', { params: { bank_code: form.bank_code, account_number: form.account_number } })
        .then((res) => { if (!cancelled) setAccountTaken(!!res.data.taken); })
        .catch(() => {});
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
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

  const [fees, setFees] = useState({ owed: 0, overdue: false, thisMonth: 0 });
  const [showFlex, setShowFlex] = useState(false);
  const [flexAmount, setFlexAmount] = useState('');
  const [payingFee, setPayingFee] = useState(false);
  const [feeCheckout, setFeeCheckout] = useState<{ url: string; reference: string } | null>(null);

  const loadFees = () => {
    api.get('/sellers/payment-status')
      .then((res) => {
        const history = res.data?.history || [];
        const owed = history
          .filter((p: any) => p.status !== 'paid')
          .reduce((s: number, p: any) => s + (parseFloat(p.amount_due) - parseFloat(p.amount_paid)), 0);
        setFees({
          owed: Math.round(owed * 100) / 100,
          overdue: !!res.data?.restricted,
          thisMonth: parseFloat(res.data?.current_month_due) || 0,
        });
      })
      .catch(() => {});
  };
  useEffect(() => { if (active) loadFees(); }, [active]);

  const startFeePayment = async (amount?: number) => {
    setPayingFee(true);
    try {
      const { data } = await api.post('/sellers/payment-status/pay', amount ? { amount } : {});
      setFeeCheckout({ url: data.authorization_url, reference: data.reference });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not start payment' });
    } finally {
      setPayingFee(false);
    }
  };

  const verifyFeePayment = async (reference: string) => {
    try {
      await api.post('/sellers/payment-status/verify', { reference });
      Toast.show({ type: 'success', text1: 'Payment received' });
      setShowFlex(false);
      setFlexAmount('');
      loadFees();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not verify payment' });
    } finally {
      setFeeCheckout(null);
    }
  };

  // ── Background orbs: each circle orbits its own corner, no crossing ──
  const planTier: 'free' | 'pro' | 'premium' = isPlanActive ? (String(user!.plan).toLowerCase() as any) : 'free';
  const tierColor = planTier === 'premium' ? '#a855f7' : planTier === 'pro' ? '#3b82f6' : colors.brand;

  const orb = useRef(new Animated.Value(0)).current;
  const orbTint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    orb.setValue(0);
    const orbit = Animated.loop(
      Animated.timing(orb, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: false })
    );
    const tint = Animated.loop(
      Animated.sequence([
        Animated.delay(7000),
        Animated.timing(orbTint, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.delay(1800),
        Animated.timing(orbTint, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ])
    );
    orbit.start();
    tint.start();
    return () => { orbit.stop(); tint.stop(); };
  }, []);

  const PTS = Array.from({ length: 17 }, (_, i) => i / 16);
  const wave = (fn: (a: number) => number, amp: number, phase: number, dir: number) =>
    orb.interpolate({
      inputRange: PTS,
      outputRange: PTS.map((t) => amp * fn(2 * Math.PI * (dir * t + phase))),
    });

  const orbAStyle = {
    opacity: orb.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.1, 0.22, 0.1, 0.22, 0.1] }),
    transform: [
      { translateX: wave(Math.sin, 34, 0, 1) },
      { translateY: wave(Math.cos, 24, 0, 1) },
      { scale: orb.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.22, 1, 1.22, 1] }) },
    ],
  };
  const orbBStyle = {
    opacity: orb.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.16, 0.07, 0.16, 0.07, 0.16] }),
    transform: [
      { translateX: wave(Math.sin, 30, 0.5, -1) },
      { translateY: wave(Math.cos, 26, 0.5, -1) },
      { scale: orb.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.8, 1, 0.8, 1] }) },
    ],
  };
  const orbColor = orbTint.interpolate({ inputRange: [0, 1], outputRange: [colors.brand, tierColor] });

  const inputStyle = {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, fontSize: 15, color: colors.text,
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
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.card }} />
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: orbColor },
            orbAStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', bottom: -80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: orbColor },
            orbBStyle,
          ]}
        />
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20,
            borderWidth: 1, borderColor: `${colors.brand}22`,
          }}
        />

        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          {/* Label + eye */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', letterSpacing: 0.3, color: colors.textMuted }}>
              Available Balance
            </Text>
            <Pressable onPress={handleToggleBalance} hitSlop={12}>
              {balanceRevealed ? (
                <EyeOff size={19} color={colors.textMuted} />
              ) : (
                <Eye size={19} color={colors.textMuted} />
              )}
            </Pressable>
          </View>

          {/* Big number + USD */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textMuted, marginRight: 6, marginBottom: 5 }}>
                GHS
              </Text>
              <Text
                style={{ fontSize: 38, fontWeight: '900', color: colors.text, letterSpacing: -1.2, fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {balanceRevealed ? money(balance) : '••••••'}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                backgroundColor: colors.inputBg ?? `${colors.border}30`,
                borderWidth: 1, borderColor: `${colors.border}60`,
                marginLeft: 10, marginBottom: 5,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.2 }}>
                {balanceRevealed
                  ? ghsToUsdRate !== null ? `≈ $${money(balance * ghsToUsdRate)}` : '≈ $—'
                  : '≈ $••.••'}
              </Text>
            </View>
          </View>

          {/* Trend tag */}
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 2,
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                backgroundColor: changePct === null ? (colors.inputBg ?? `${colors.border}30`) : changePct >= 0 ? '#22c55e' : '#ef4444',
              }}
            >
              {changePct !== null && (changePct >= 0 ? (
                <ChevronUp size={13} color="#fff" strokeWidth={3} />
              ) : (
                <ChevronDown size={13} color="#fff" strokeWidth={3} />
              ))}
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: changePct === null ? colors.textMuted : '#fff' }}>
                {changePct === null ? '—' : `${Math.abs(changePct).toFixed(1)}%`}
              </Text>
            </View>
          </View>

          {/* Fees owed */}
          <View style={{ height: 1, backgroundColor: `${colors.border}80`, marginTop: 14 }} />
          <Text style={{ color: colors.text, marginTop: 12, fontWeight: '700' }}>
            Fees owed: GHS {money(fees.owed)}
          </Text>
          {fees.overdue && (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
              Overdue. Your listings are hidden until you pay in full.
            </Text>
          )}
          {fees.owed > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable onPress={() => startFeePayment()} disabled={payingFee} style={[primaryBtn, { flex: 1 }]}>
                <Text style={{ color: colors.textOnGold, fontWeight: '700' }}>Pay full</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFlex((v) => !v)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.brand, alignItems: 'center' }}
              >
                <Text style={{ color: colors.brand, fontWeight: '700' }}>Pay part</Text>
              </Pressable>
            </View>
          )}
          {showFlex && fees.owed > 0 && (
            <View style={{ marginTop: 10 }}>
              <TextInput
                value={flexAmount}
                onChangeText={setFlexAmount}
                placeholder={`1.00 – ${fees.owed.toFixed(2)}`}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                style={inputStyle}
              />
              <Pressable
                onPress={() => startFeePayment(parseFloat(flexAmount))}
                disabled={payingFee || !parseFloat(flexAmount)}
                style={[primaryBtn, { marginTop: 8 }]}
              >
                <Text style={{ color: colors.textOnGold, fontWeight: '700' }}>Pay this amount</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* WITHDRAW FUNDS */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Wallet size={20} color={colors.brand} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Withdraw Funds</Text>
        </View>

        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>Select Payout Account</Text>
        <ModalPicker
          value={selectedAccountId}
          onSelect={setSelectedAccountId}
          placeholder="Select an account"
          options={accounts.map((a) => ({
            label: `${a.account_name} (${a.bank_name || a.method})${a.is_default ? ' ⭐' : ''}`,
            value: a.id,
          }))}
        />

        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Amount (GHS)</Text>
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
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>
            {withdrawing ? 'Processing...' : 'Withdraw Funds'}
          </Text>
        </Pressable>

        {!user?.verified && (
          <Text style={{ fontSize: 13, color: colors.error, textAlign: 'center', marginTop: 8 }}>
            ⚠️ Verify your account to enable withdrawals.
          </Text>
        )}
      </View>

      {/* SAVED ACCOUNTS */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Landmark size={20} color={colors.brand} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Saved Payout Accounts</Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 16 }}>
          These are the accounts you can withdraw your earnings to.
        </Text>

        {accounts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontSize: 15, color: colors.textFaint }}>No payout account set up yet.</Text>
            <Pressable onPress={() => setShowAddModal(true)} style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand }}>+ Add payout account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {accounts.map((acc) => (
              <View key={acc.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: acc.is_default ? colors.brand : colors.border, backgroundColor: acc.is_default ? colors.brandSoft : colors.card }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{acc.account_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                    {acc.bank_name || acc.method} · •••• {acc.account_number.slice(-4)}
                  </Text>
                  {acc.is_default && <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, marginTop: 2 }}>Default</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {!acc.is_default && (
                    <Pressable onPress={() => handleSetDefault(acc.id)} disabled={settingDefault === acc.id}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>
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
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.brand }}>+ Add another account</Text>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: withdrawalsTab === t ? colors.brand : colors.textMuted }}>
                {t === 'requests' ? 'Withdrawal requests' : 'Completed'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loadingWithdrawals ? (
          <ActivityIndicator color={colors.brand} />
        ) : withdrawalsTab === 'requests' ? (
          requestWithdrawals.length === 0 ? (
            <Text style={{ fontSize: 15, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>
              No pending withdrawal requests.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {requestWithdrawals.map((w) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>GHS {money(w.amount)}</Text>
                    <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                      {w.account_name} · {new Date(w.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warning, textTransform: 'uppercase' }}>{w.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : completedWithdrawals.length === 0 ? (
          <Text style={{ fontSize: 15, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>
            No completed withdrawals yet.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {completedWithdrawals.map((w) => (
              <View key={w.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>GHS {parseFloat(w.amount).toFixed(2)}</Text>
                    <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                      {w.account_name} · {new Date(w.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success, textTransform: 'uppercase' }}>Completed</Text>
                  </View>
                </View>

                {w.reported_at ? (
                  <Text style={{ fontSize: 13, color: colors.error, marginTop: 8 }}>
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
                      style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 13, color: colors.text, backgroundColor: colors.inputBg, minHeight: 60, textAlignVertical: 'top' }}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => { setReportingId(null); setReportMessage(''); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={() => handleSubmitReport(w.id)} disabled={submittingReport} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.error, alignItems: 'center', opacity: submittingReport ? 0.6 : 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>{submittingReport ? 'Submitting…' : 'Submit'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setReportingId(w.id)} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error, textDecorationLine: 'underline' }}>Not received?</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <PaystackCheckout
        visible={!!feeCheckout}
        authorizationUrl={feeCheckout?.url || null}
        callbackUrl={PAYMENT_CALLBACK_URL}
        onSuccess={verifyFeePayment}
        onClose={() => setFeeCheckout(null)}
      />

      {/* PASSWORD MODAL — reveal balance */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setShowPasswordModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => setShowPasswordModal(false)} style={{ position: 'absolute', top: 16, right: 16 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>Confirm it's you</Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4 }}>Enter your password to view your available balance.</Text>
            <TextInput
              value={balancePassword}
              onChangeText={setBalancePassword}
              placeholder="••••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={[inputStyle, { marginTop: 16 }]}
            />
            <Pressable onPress={handleVerifyPassword} disabled={verifyingPassword} style={[primaryBtn, { marginTop: 16, opacity: verifyingPassword ? 0.6 : 1 }]}>
              <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>{verifyingPassword ? 'Verifying…' : 'Show balance'}</Text>
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
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>Confirm withdrawal</Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4 }}>
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
              <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>{withdrawing ? 'Processing…' : 'Confirm withdrawal'}</Text>
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
              <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>Add payout account</Text>
              <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4 }}>Your earnings will be sent here.</Text>

              <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 16, gap: 4 }}>
                {(['bank', 'mobile_money'] as const).map((m) => (
                  <Pressable key={m} onPress={() => { setMethod(m); setForm({ bank_code: '', account_number: '', account_name: '' }); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: method === m ? colors.card : 'transparent' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: method === m ? colors.brand : colors.textMuted }}>
                      {m === 'bank' ? 'Bank' : 'Mobile Money'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 16, marginBottom: 4 }}>
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

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Account number</Text>
              <TextInput
                value={form.account_number}
                onChangeText={(v) => setForm({ ...form, account_number: v.replace(/\D/g, ''), account_name: '' })}
                placeholder="0123456789"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={inputStyle}
                maxLength={16}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 4 }}>Account name</Text>
              <View style={[inputStyle, { opacity: form.account_name ? 1 : 0.7 }]}>
                <Text style={{ fontSize: 15, color: form.account_name ? colors.text : colors.textFaint }}>
                  {form.account_name || 'Appears automatically'}
                </Text>
              </View>
              {resolveFailed && (
                <Text style={{ fontSize: 13, color: colors.error, marginTop: 6 }}>
                  We couldn't find an account with these details. Check the number and network.
                </Text>
              )}
              {accountTaken && (
                <Text style={{ fontSize: 13, color: colors.error, marginTop: 6 }}>
                  An account with this number already exists. Use a different account.
                </Text>
              )}
              {resolving && <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>Resolving account name…</Text>}

              <Pressable onPress={handleAddAccount} disabled={saving || !form.account_name || resolving || accountTaken} style={[primaryBtn, { marginTop: 20, opacity: saving || !form.account_name || resolving || accountTaken ? 0.5 : 1 }]}>
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>{saving ? 'Adding…' : 'Add account'}</Text>
              </Pressable>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}