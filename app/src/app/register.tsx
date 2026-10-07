import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated, Easing, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const AnimatedImage = Animated.createAnimatedComponent(ExpoImage);
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { Mail, Lock, Eye, EyeOff, User, ShoppingBag, Store, Phone, Landmark, Loader2, CheckCircle, XCircle, ArrowLeft, MapPin, Map as MapIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/client';
import { LOGO_DARK, LOGO_LIGHT } from '@/data/media';
import ModalPicker from '@/components/ModalPicker';
import PasswordStrength from '@/components/PasswordStrength';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import LocationPickerModal from '@/components/LocationPickerModal';

// ---- SCHOOLS / PLACES / COORDS ----
const SCHOOLS = ['KNUST','ATU','UCC','UHAS','UG','UDS','UMaT','UEW','UPSA','PentUni','KsTU','CU','Ashesi','KTU','GCTU','GIMPA','UENR'];

const PLACES_BY_SCHOOL: Record<string, string[]> = {
  KNUST: ['Main Entrance / Main Gate','Ayeduase Gate','Conti Roundabout','Commercial Area','Agric Junction','Botanical Gardens',"Students' Clinic",'Great Hall','Central Classroom Block','Main Administration','Ahinsan Gate','Ayeduase Junction','Ayeduase Market','Tech Junction','Kotei area','Kentinkrono area','Queen Elizabeth II Hall','Unity Hall','Independence Hall','Republic Hall','University Hall (Katanga)','Africa Hall'],
  UG: ['Main University Gate','University Avenue','University Square','Balme Library','Great Hall / Legon Hill','Open-Air Theatre','Central Cafeteria','Sports fields','UG Stadium','Banking Square','UG Medical Centre','Okponglo','Madina','Haatso','East Legon','Night Market','Legon Hall','Akuafo Hall','Commonwealth Hall','Volta Hall','Mensah Sarbah Hall','Limann Hall','Kwapong Hall'],
  ATU: ['Main Campus / Main Gate','Barnes Road','ATU Library – N Block','ATU Library – B-Tech Block','University Clinic','Cafeteria','Multipurpose Sports Facility','Tennis Court','Kinbu / Barnes Road area','Accra Central','Tudu','Makola area','Kaneshie transport corridor'],
  UCC: ['Main / Old Site','Northern / New Site','Main Administration','UCC Main Library','University Garden','University Zoo','Science area','UCC Stadium / sports areas','SRC Area','UCC Main Gate area','Amamoma','Kotokuraba area','Cape Coast town centre','Oguaa Hall','Atlantic Hall','Kwame Nkrumah Hall','Valco Hall','Casely Hayford Hall','Adehye Hall','SRC Hall'],
  UHAS: ['UHAS Main Campus','Main Entrance','Sokode campus area','Asogli campus area','UHAS CEDI Auditorium','Sokode','Ho township','Ho Central','Ho Market area','Sokode Hall of Residence','Asogli Hall of Residence'],
  UDS: ['Tamale/Dungu Campus Main Administration','Multipurpose Sports Complex','UDS Basic School','Medical School Blocks','Tamale Campus Library','Tamale Campus Clinic','UDS Central Mosque','UDS Guesthouse','City Campus','Nyankpala Campus','Dungu','Sagnarigu','Tamale city/student areas','GUSSS Hostel (Tamale Campus)','Dungu Campus Hall','Union Hall (Nyankpala)'],
  UEW: ['North Campus','Central Campus','South Campus','Osagyefo Library','JAM Conference Centre','North Assembly Hall','Technology Block','Winneba township','Simpa Hall','Ghartey Hall','Aggrey Hall','University Hall','Ajumako Hall','GUSSS Halls'],
  UPSA: ['UPSA Main Gate','UPSA Hostel Complex','UPSA Library','UPSA Business School','UPSA Astroturf / sports area','East Legon','Madina','American House','Legon','Trinity Avenue / UPSA hostel area','Hostel A','Matthew Opoku Prempeh Hostel','Amon Kotei Hostel'],
  PentUni: ['Pentecost University Main Campus','Main Gate','Campus Cafeteria','Residence halls','Lecture/academic areas','Pentecost University bus stop','Kyeiwaa Junction','Ontario Hostel area','Clare Hostel area','Sowutuom','Kwashieman','Lapaz','Yeboah Hall','Safo Hall','Arnan Hall'],
  KsTU: ['Main Campus','Main Gate','KsTU Library','SRC area','Lecture/classroom areas','Sports/recreation areas','Adako-Jachie campus','Asafo','Amakom','Adako-Jachie','Kumasi Central','Adum','Asafo transport area'],
  CU: ['Miotso Main Campus','Main Gate','Central Students Plaza','University Library','Johnson Kanda Building','VPY Gadzekpo Building','Lecture theatres','Student hostels','Recreational facilities','Dawhenya','Ningo-Prampram area','Accra-Aflao Highway corridor','Miotso community','Tema-side corridor'],
  UMaT: ['UMaT Main Gate','Administration/academic area','UMaT Library','Lecture/engineering facilities','Chamber of Mines Hall','K.T. Hall','Gold Refinery Hall','Campus recreational areas','Tarkwa town','Tarkwa Main Market area','UMaT Main Gate bus stop','TNA Park / Tarkwa & Abosso Stadium','Tarkwa transport/town centre'],
  Ashesi: ['Ashesi Main Gate','University Avenue','Warren Library','Radichel Hall','King Engineering Building','Ashesi Bookshop','The Hive','The Grill','Bliss Lounge','Founders Plaza','Sports Centre','Natembea Health Centre','Student residence halls','Berekuso township','Aburi road corridor','Hosanna Hostel','Dufie Hostel','Tanko Hostel','Masere Hostel','Columbiana Hostel'],
  KTU: ['KTU Main Gate','Koforidua - Nsutam Road','KTU Library','Lecture blocks','GETFund Hostel','Student hostels','Koforidua town centre','Koforidua Shopping Mall area','Mile 50 area','Haleluya Hostel','Lords Hostel','Universal Hostel'],
  GCTU: ['Tesano Main Campus','Abeka Campus','GCTU Main Gate','Silicon Valley Auditorium','GTUC Hostel Blocks A, B & C','International Students Hostel','Lecture halls','Campus library','Tesano township','Tesano Palace area','Abeka Hostel area','North Kaneshie area'],
  GIMPA: ['GIMPA Main Gate','Greenhill Campus','GIMPA Main Library','Faculty of Law Library','GIMPA Business School','GIMPA Executive Conference Centre (GECC)',"Student's Hostel",'Lecture halls','Campus library','Legon Bypass','West Legon area','Achimota area'],
  UENR: ['Sunyani Campus (Main Administration & Library)','Nsoatre Campus (School of Engineering)','Dormaa Ahenkro Campus','UENR Main Gate','Lecture halls','Campus library','Student hostels','Sunyani township','Sunyani Main Market area'],
};

const SCHOOL_COORDS: Record<string,{lat:number;lng:number}> = {
  KNUST:{lat:6.6732,lng:-1.5654}, ATU:{lat:5.554028,lng:-0.205556}, UHAS:{lat:6.6008,lng:0.4713},
  UCC:{lat:5.1153,lng:-1.2903}, UDS:{lat:9.393273,lng:-0.823513}, UEW:{lat:5.35,lng:-0.625},
  UPSA:{lat:5.6614,lng:-0.1664}, PentUni:{lat:5.6262,lng:-0.2742}, KsTU:{lat:6.6911,lng:-1.61},
  CU:{lat:5.5663,lng:-0.241}, UG:{lat:5.65083,lng:-0.18694}, UMaT:{lat:5.3005,lng:-1.99},
  Ashesi:{lat:5.75972,lng:-0.21972}, KTU:{lat:6.063,lng:-0.2642}, GCTU:{lat:5.5998,lng:-0.2362},
  GIMPA:{lat:5.638,lng:-0.167}, UENR:{lat:7.3495,lng:-2.3435},
};

function distanceKm(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180) * Math.cos((lat2*Math.PI)/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function findNearestSchool(lat:number, lng:number) {
  let nearest = '', minDist = Infinity;
  for (const [code, c] of Object.entries(SCHOOL_COORDS)) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d < minDist) { minDist = d; nearest = code; }
  }
  return nearest;
}

const COUNTRY_CODES = [
  {code:'+233',label:'+233 (Ghana)'},{code:'+234',label:'+234 (Nigeria)'},{code:'+225',label:'+225 (Côte d\'Ivoire)'},
  {code:'+221',label:'+221 (Senegal)'},{code:'+223',label:'+223 (Mali)'},{code:'+226',label:'+226 (Burkina Faso)'},
  {code:'+227',label:'+227 (Niger)'},{code:'+228',label:'+228 (Togo)'},{code:'+229',label:'+229 (Benin)'},
  {code:'+220',label:'+220 (Gambia)'},{code:'+224',label:'+224 (Guinea)'},{code:'+245',label:'+245 (Guinea-Bissau)'},
  {code:'+232',label:'+232 (Sierra Leone)'},{code:'+231',label:'+231 (Liberia)'},{code:'+238',label:'+238 (Cape Verde)'},
  {code:'+222',label:'+222 (Mauritania)'},{code:'+254',label:'+254 (Kenya)'},{code:'+256',label:'+256 (Uganda)'},
  {code:'+255',label:'+255 (Tanzania)'},{code:'+250',label:'+250 (Rwanda)'},{code:'+257',label:'+257 (Burundi)'},
  {code:'+251',label:'+251 (Ethiopia)'},{code:'+253',label:'+253 (Djibouti)'},{code:'+252',label:'+252 (Somalia)'},
  {code:'+211',label:'+211 (South Sudan)'},{code:'+249',label:'+249 (Sudan)'},{code:'+291',label:'+291 (Eritrea)'},
  {code:'+248',label:'+248 (Seychelles)'},{code:'+230',label:'+230 (Mauritius)'},{code:'+237',label:'+237 (Cameroon)'},
  {code:'+243',label:'+243 (DR Congo)'},{code:'+242',label:'+242 (Congo)'},{code:'+241',label:'+241 (Gabon)'},
  {code:'+235',label:'+235 (Chad)'},{code:'+236',label:'+236 (Central African Republic)'},{code:'+240',label:'+240 (Equatorial Guinea)'},
  {code:'+239',label:'+239 (São Tomé and Príncipe)'},{code:'+27',label:'+27 (South Africa)'},{code:'+260',label:'+260 (Zambia)'},
  {code:'+263',label:'+263 (Zimbabwe)'},{code:'+267',label:'+267 (Botswana)'},{code:'+264',label:'+264 (Namibia)'},
  {code:'+258',label:'+258 (Mozambique)'},{code:'+265',label:'+265 (Malawi)'},{code:'+266',label:'+266 (Lesotho)'},
  {code:'+268',label:'+268 (Eswatini)'},{code:'+244',label:'+244 (Angola)'},{code:'+20',label:'+20 (Egypt)'},
  {code:'+212',label:'+212 (Morocco)'},{code:'+216',label:'+216 (Tunisia)'},{code:'+213',label:'+213 (Algeria)'},
  {code:'+218',label:'+218 (Libya)'},{code:'+1',label:'+1 (USA/Canada)'},{code:'+44',label:'+44 (UK)'},
  {code:'+33',label:'+33 (France)'},{code:'+49',label:'+49 (Germany)'},{code:'+91',label:'+91 (India)'},
  {code:'+971',label:'+971 (UAE)'},{code:'+86',label:'+86 (China)'},
];

const MOBILE_MONEY_NETWORKS = [
  { code: 'MTN', name: 'MTN Mobile Money' },
  { code: 'VOD', name: 'Vodafone Cash / Telecel Cash' },
  { code: 'AT', name: 'AirtelTigo Money' },
];

const NETWORK_PATTERNS: Record<string, RegExp> = {
  MTN: /^(024|054|055|059|023|053|057)\d{7}$/,
  VOD: /^(020|050)\d{7}$/,
  AT: /^(026|027|056)\d{7}$/,
};

const BANK_PATTERNS: Record<string,{minLength:number;label:string}> = {
  '001':{minLength:10,label:'GCB'},'002':{minLength:10,label:'Stanbic'},'003':{minLength:10,label:'Ecobank'},
  '004':{minLength:10,label:'ABSA'},'005':{minLength:10,label:'Access Bank'},'006':{minLength:10,label:'UBA'},
  '007':{minLength:10,label:'Fidelity'},'008':{minLength:10,label:'First National'},'009':{minLength:10,label:'Republic Bank'},
  '010':{minLength:10,label:'CalBank'},'011':{minLength:10,label:'Prudential Bank'},'012':{minLength:10,label:'GT Bank'},
  '013':{minLength:10,label:'Bank of Africa'},'014':{minLength:10,label:'First Atlantic'},'015':{minLength:10,label:'Zenith Bank'},
  '016':{minLength:10,label:'FBN Bank'},'017':{minLength:10,label:'Societe Generale'},'018':{minLength:10,label:'UMB'},
  '019':{minLength:10,label:'NIB'},'020':{minLength:10,label:'ADB'},'021':{minLength:10,label:'OmniBSIC'},
};
const DEFAULT_BANK_RULE = { minLength: 10, label: 'Bank' };

const LOGO_FULL = 'Tre-X';
const TAGLINE_FULL = 'Redefining Campus Shopping';
const TYPE_SPEED_MS = 50;
const PULSE_ALONE_MS = 800;
const HOLD_MS = 10000;

function isPasswordValid(pw: string) {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

export default function RegisterScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; ref?: string }>();

  const initialTab = params.tab === 'seller' ? 'seller' : 'buyer';
  const [accountType, setAccountType] = useState<'buyer'|'seller'>(initialTab);

  const [form, setForm] = useState({
    name: '', university_email: '', password: '', confirm_password: '',
    school: SCHOOLS[0], meeting_place: '', whatsapp: '', sms_number: '',
  });
  const [whatsappCode, setWhatsappCode] = useState('+233');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [smsCode, setSmsCode] = useState('+233');
  const [smsNumber, setSmsNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [buyerSchool, setBuyerSchool] = useState('');
  const [buyerExtraInfo, setBuyerExtraInfo] = useState('');
  const [detectingSchool, setDetectingSchool] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<'map' | 'gps' | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [payoutMethod, setPayoutMethod] = useState<'bank'|'mobile_money'>('bank');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [banks, setBanks] = useState<{code:string;name:string}[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const [validationResult, setValidationResult] = useState<{isValid:boolean;message:string;type:string}>({ isValid:false, message:'', type:'' });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [accountTaken, setAccountTaken] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<{checking:boolean;available:boolean|null;message:string}>({ checking:false, available:null, message:'' });

  const logoSrc = theme === 'dark' ? LOGO_LIGHT : LOGO_DARK;

  // pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 1750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const pulseOpacity = pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.55, 1] });

  // typewriter sequence
  const [phase, setPhase] = useState<'pulse'|'typing-logo'|'typing-tagline'|'hold'>('pulse');
  const [logoText, setLogoText] = useState('');
  const [taglineText, setTaglineText] = useState('');
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setPhase('pulse'); setLogoText(''); setTaglineText('');
    const t = setTimeout(() => setPhase('typing-logo'), PULSE_ALONE_MS);
    return () => clearTimeout(t);
  }, [cycle]);
  useEffect(() => {
    if (phase !== 'typing-logo') return;
    let i = 0;
    const iv = setInterval(() => {
      i++; setLogoText(LOGO_FULL.slice(0, i));
      if (i >= LOGO_FULL.length) { clearInterval(iv); setPhase('typing-tagline'); }
    }, TYPE_SPEED_MS);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'typing-tagline') return;
    let i = 0;
    const iv = setInterval(() => {
      i++; setTaglineText(TAGLINE_FULL.slice(0, i));
      if (i >= TAGLINE_FULL.length) { clearInterval(iv); setPhase('hold'); }
    }, TYPE_SPEED_MS);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'hold') return;
    const t = setTimeout(() => setCycle((c) => c + 1), HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);
  const isShifted = phase !== 'pulse';

  useEffect(() => {
    if (accountType !== 'seller') return;
    setLoadingBanks(true);
    api.get('/payouts/banks').then((res) => setBanks(res.data || [])).catch(() => {}).finally(() => setLoadingBanks(false));
  }, [accountType]);

  const describePlace = async (c: { lat: number; lng: number }, school: string) => {
    try {
      const [p] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      const text = [p?.name, p?.street, p?.district, p?.city].filter(Boolean).join(', ');
      setBuyerExtraInfo(text || `Near ${school}`);
    } catch {
      setBuyerExtraInfo(`Near ${school}`);
    }
  };

  const detectNearestSchool = async () => {
    if (detectingSchool) return;
    setDetectingSchool(true);
    setDetectError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectError("Couldn't get your location. Try 'Set on map' instead.");
        setDetectingSchool(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setBuyerCoords(c);
      setLocationSource('gps');
      const s = findNearestSchool(c.lat, c.lng);
      setBuyerSchool(s);
      describePlace(c, s);
    } catch {
      setDetectError("Couldn't get your location. Try 'Set on map' instead.");
    } finally {
      setDetectingSchool(false);
    }
  };

  const updateWhatsapp = (code: string, number: string) => {
    const cleaned = number.replace(/\D/g, '');
    setWhatsappNumber(cleaned);
    setForm((f) => ({ ...f, whatsapp: code + cleaned }));
  };
  const updateSms = (code: string, number: string) => {
    const cleaned = number.replace(/\D/g, '');
    setSmsNumber(cleaned);
    setForm((f) => ({ ...f, sms_number: code + cleaned }));
  };
  const updateSellerSchool = (newSchool: string) => {
    const places = PLACES_BY_SCHOOL[newSchool] || [];
    setForm((f) => ({ ...f, school: newSchool, meeting_place: places.includes(f.meeting_place) ? f.meeting_place : '' }));
  };

  useEffect(() => {
    if (accountType !== 'seller' || accountNumber.length === 0) {
      setValidationResult({ isValid:false, message:'', type:'info' });
      return;
    }
    let isValid = false, message = '', type = 'error';
    if (payoutMethod === 'bank') {
      if (!bankCode) { message = 'Please select a bank first'; }
      else {
        const rule = BANK_PATTERNS[bankCode] || DEFAULT_BANK_RULE;
        const bankName = banks.find((b) => b.code === bankCode)?.name || rule.label;
        if (accountNumber.length >= rule.minLength) { isValid = true; message = `✓ Valid ${bankName} account number`; type = 'success'; }
        else { message = `Invalid ${bankName} account number. Must be at least ${rule.minLength} digits.`; }
      }
    } else {
      if (!bankCode) { message = 'Please select a network first'; }
      else {
        const pattern = NETWORK_PATTERNS[bankCode];
        const networkName = MOBILE_MONEY_NETWORKS.find((n) => n.code === bankCode)?.name || bankCode;
        if (pattern && pattern.test(accountNumber)) { isValid = true; message = `✓ Valid ${networkName} number`; type = 'success'; }
        else { message = `Invalid ${networkName} number.`; }
      }
    }
    setValidationResult({ isValid, message, type });
  }, [accountNumber, payoutMethod, bankCode, accountType, banks]);

  useEffect(() => {
    setAccountTaken(false);
    if (accountType !== 'seller' || !bankCode || !validationResult.isValid) return;
    const t = setTimeout(() => {
      api.get('/payouts/check-account', { params: { bank_code: bankCode, account_number: accountNumber } })
        .then((res) => setAccountTaken(!!res.data.taken))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [accountNumber, bankCode, accountType, validationResult.isValid]);

  useEffect(() => {
    const name = form.name.trim();
    if (!name) { setUsernameCheck({ checking:false, available:null, message:'' }); return; }
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(name)) {
      setUsernameCheck({ checking:false, available:false, message:'Use 3–20 letters, numbers, "." or "_" only' });
      return;
    }
    setUsernameCheck((s) => ({ ...s, checking: true }));
    const t = setTimeout(() => {
      api.get('/auth/check-username', { params: { username: name } })
        .then((res) => setUsernameCheck({ checking:false, available:res.data.available, message: res.data.available ? 'Username is available' : 'That username is already taken' }))
        .catch(() => setUsernameCheck({ checking:false, available:null, message:'' }));
    }, 500);
    return () => clearTimeout(t);
  }, [form.name]);

  const onSubmit = async () => {
    const digits = whatsappNumber.replace(/\D/g, '');
    if (digits.length !== 9) { Toast.show({ type:'error', text1:'WhatsApp number must be exactly 9 digits after the country code.' }); return; }
    const smsDigits = smsNumber.replace(/\D/g, '');
    if (smsDigits.length !== 9) { Toast.show({ type:'error', text1:'SMS phone number must be exactly 9 digits after the country code.' }); return; }
    if (usernameCheck.available === false) { Toast.show({ type:'error', text1: usernameCheck.message }); return; }
    if (form.password !== form.confirm_password) { Toast.show({ type:'error', text1:"Passwords don't match" }); return; }
    if (!isPasswordValid(form.password)) { Toast.show({ type:'error', text1:'Password must be 8+ chars with a letter, number, and symbol' }); return; }
    if (accountType === 'buyer') {
      if (!buyerSchool) { Toast.show({ type:'error', text1:'Please select or wait for us to detect your nearest school.' }); return; }
      if (!buyerCoords) { Toast.show({ type:'error', text1:'Please set your location on the map or use your current location.' }); return; }
      if (!buyerExtraInfo.trim()) { Toast.show({ type:'error', text1:'Still finding your address, try again in a second.' }); return; }
    }
    if (accountType === 'seller' && !form.meeting_place) { Toast.show({ type:'error', text1:'Please select a meeting place on your campus.' }); return; }
    if (!agreedToTerms) { Toast.show({ type:'error', text1:'Please agree to the Terms of Service and Privacy Policy' }); return; }
    if (accountType === 'seller') {
      if (!bankCode || !accountNumber || !accountName) { Toast.show({ type:'error', text1:'Please fill in all payout account details.' }); return; }
      if (!validationResult.isValid) { Toast.show({ type:'error', text1: validationResult.message || 'Invalid account number.' }); return; }
      if (accountTaken) { Toast.show({ type:'error', text1: 'An account with this number already exists.' }); return; }
    }

    setLoading(true);
    try {
      const payload: any = {
        username: form.name,
        university_email: form.university_email,
        password: form.password,
        school: accountType === 'seller' ? form.school : buyerSchool,
        account_type: accountType,
        whatsapp: form.whatsapp,
        sms_number: form.sms_number,
        meeting_place: accountType === 'seller' ? form.meeting_place : null,
        location: accountType === 'buyer' ? buyerExtraInfo : null,
        location_lat: accountType === 'buyer' ? buyerCoords?.lat ?? null : null,
        location_lng: accountType === 'buyer' ? buyerCoords?.lng ?? null : null,
        referral_code: params.ref || null,
      };
      if (accountType === 'seller') {
        payload.bank_code = bankCode;
        payload.account_number = accountNumber;
        payload.account_name = accountName;
        payload.payout_method = payoutMethod;
      }
      const newUser = await register(payload);
      Toast.show({ type:'success', text1:`Account created! Welcome to Tre-X, ${newUser.name}` });
      router.replace('/');
    } catch (err: any) {
      Toast.show({ type:'error', text1:'Registration failed', text2: err?.response?.data?.error || '' });
    } finally {
      setLoading(false);
    }
  };

  const networkOptions = payoutMethod === 'bank' ? banks : MOBILE_MONEY_NETWORKS;
  const sellerPlaces = PLACES_BY_SCHOOL[form.school] || [];

  const inputStyle = {
    height: 46, paddingLeft: 40, paddingRight: 16, paddingVertical: 0,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBg, color: colors.text, fontSize: 14,
  };
  const labelStyle = { fontSize: 14, fontWeight: '600' as const, color: colors.textSecondary, marginTop: 16 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingVertical: 40 }}>

            {/* Animated logo */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ translateX: isShifted ? -8 : 0 }] }}>
                  {logoSrc && (
                    <AnimatedImage
                      source={logoSrc}
                      style={{ width: 48, height: 48, transform: [{ scale: pulse }], opacity: pulseOpacity }}
                      contentFit="contain"
                      cachePolicy="disk"
                    />
                  )}
                </Animated.View>
                <View style={{ marginLeft: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>{logoText.slice(0,3)}</Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginHorizontal: 2, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>{logoText.slice(3,4)}</Text>
                    <Text style={{ fontSize: 30, fontWeight: '900', fontStyle: 'italic', color: colors.brand, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>{logoText.slice(4,5)}</Text>
                    {phase === 'typing-logo' && <View style={{ width: 2, height: 20, backgroundColor: colors.text, marginLeft: 4 }} />}
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 12, color: colors.textMuted, minHeight: 16 }}>
                    {taglineText}{phase === 'typing-tagline' && <Text style={{ color: colors.textMuted }}>|</Text>}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card */}
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 24 }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Become a Member</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>It only takes a minute.</Text>

              {/* Account type toggle */}
              <View style={{ marginTop: 20, flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, gap: 8 }}>
                {(['buyer','seller'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setAccountType(t)}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingVertical: 10, borderRadius: 8,
                      backgroundColor: accountType === t ? colors.card : 'transparent',
                    }}
                  >
                    {t === 'buyer' ? <ShoppingBag size={15} color={accountType === t ? colors.brand : colors.textMuted} /> : <Store size={15} color={accountType === t ? colors.brand : colors.textMuted} />}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: accountType === t ? colors.brand : colors.textMuted }}>
                      {t === 'buyer' ? 'Shop & Find' : 'Sell & Offer'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Username */}
              <Text style={labelStyle}>Username</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <User size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  placeholder="campusking"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  style={[inputStyle, { paddingRight: 40 }]}
                />
                <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  {usernameCheck.checking && <Loader2 size={16} color={colors.textFaint} />}
                  {!usernameCheck.checking && usernameCheck.available === true && <CheckCircle size={16} color={colors.success} />}
                  {!usernameCheck.checking && usernameCheck.available === false && <XCircle size={16} color={colors.error} />}
                </View>
              </View>
              {usernameCheck.message && (
                <Text style={{ fontSize: 12, marginTop: 4, color: usernameCheck.available === true ? colors.success : usernameCheck.available === false ? colors.error : colors.textFaint }}>
                  {usernameCheck.message}
                </Text>
              )}

              {/* Email */}
              <Text style={labelStyle}>{accountType === 'seller' ? 'University Email' : 'Email'}</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Mail size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.university_email}
                  onChangeText={(v) => setForm({ ...form, university_email: v })}
                  placeholder={accountType === 'seller' ? 'you@st.knust.edu.gh' : 'you@gmail.com'}
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={inputStyle}
                />
              </View>

              {/* WhatsApp */}
              <Text style={labelStyle}>WhatsApp Number</Text>
              <View style={{ flexDirection: 'row', marginTop: 4, gap: 6 }}>
                <View style={{ width: 100 }}>
                  <ModalPicker
                    value={whatsappCode}
                    showValueOnly
                    onSelect={(v) => { setWhatsappCode(v); updateWhatsapp(v, whatsappNumber); }}
                    options={COUNTRY_CODES.map((c) => ({ label: c.label, value: c.code }))}
                  />
                </View>
                <View style={{ position: 'relative', flex: 1 }}>
                  <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                    <Phone size={16} color={colors.textFaint} />
                  </View>
                  <TextInput
                    value={whatsappNumber}
                    onChangeText={(v) => { const d = v.replace(/\D/g,''); if (d.length <= 9) updateWhatsapp(whatsappCode, d); }}
                    placeholder="e.g. 24 123 4567"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />
                </View>
              </View>

              {/* SMS */}
              <Text style={labelStyle}>Phone Number (for SMS alerts)</Text>
              <View style={{ flexDirection: 'row', marginTop: 4, gap: 6 }}>
                <View style={{ width: 100 }}>
                  <ModalPicker
                    value={smsCode}
                    showValueOnly
                    onSelect={(v) => { setSmsCode(v); updateSms(v, smsNumber); }}
                    options={COUNTRY_CODES.map((c) => ({ label: c.label, value: c.code }))}
                  />
                </View>
                <View style={{ position: 'relative', flex: 1 }}>
                  <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                    <Phone size={16} color={colors.textFaint} />
                  </View>
                  <TextInput
                    value={smsNumber}
                    onChangeText={(v) => { const d = v.replace(/\D/g,''); if (d.length <= 9) updateSms(smsCode, d); }}
                    placeholder="e.g. 24 123 4567"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />
                </View>
              </View>

              {/* Seller: School + Meeting place */}
              {accountType === 'seller' && (
                <>
                  <Text style={labelStyle}>School & Campus Location</Text>
                  <View style={{ flexDirection: 'row', marginTop: 4, gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <ModalPicker
                        value={form.school}
                        onSelect={updateSellerSchool}
                        options={SCHOOLS.map((s) => ({ label: s, value: s }))}
                      />
                    </View>
                    <View style={{ flex: 1.4 }}>
                      <ModalPicker
                        value={form.meeting_place}
                        onSelect={(v) => setForm({ ...form, meeting_place: v })}
                        placeholder="Select your campus spot"
                        options={sellerPlaces.map((p) => ({ label: p, value: p }))}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Buyer: auto-detect school + extra info */}
              {accountType === 'buyer' && (
                <>
                  <Text style={labelStyle}>Your Campus & Location Details</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 6 }}>
                    {([
                      { key: 'map', label: 'Set on map', onPress: () => setShowLocationPicker(true), busy: false },
                      { key: 'gps', label: detectingSchool ? 'Getting…' : 'Use current location', onPress: detectNearestSchool, busy: detectingSchool },
                    ] as const).map((b) => {
                      const active = locationSource === b.key;
                      const c = active ? '#059669' : colors.textSecondary;
                      return (
                        <Pressable
                          key={b.key}
                          onPress={b.onPress}
                          disabled={b.busy}
                          style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                            paddingVertical: 12, borderRadius: 12, borderWidth: 1, opacity: b.busy ? 0.6 : 1,
                            borderColor: active ? '#6ee7b7' : colors.border,
                            backgroundColor: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                          }}
                        >
                          {b.busy ? <ActivityIndicator size="small" color={colors.brand} /> : b.key === 'map' ? <MapIcon size={15} color={c} /> : <MapPin size={15} color={c} />}
                          <Text style={{ fontSize: 13, fontWeight: '600', color: c }}>{b.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {!!buyerSchool && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Nearest campus: {buyerSchool}</Text>
                  )}
                  {!!buyerExtraInfo && (
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>📍 {buyerExtraInfo}</Text>
                  )}
                  {detectError && <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>{detectError}</Text>}
                </>
              )}

              {/* Seller: Payout */}
              {accountType === 'seller' && (
                <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Landmark size={16} color={colors.brand} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Payout Account</Text>
                  </View>

                  <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12, gap: 4 }}>
                    {(['bank','mobile_money'] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => { setPayoutMethod(m); setBankCode(''); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: payoutMethod === m ? colors.card : 'transparent' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: payoutMethod === m ? colors.brand : colors.textMuted }}>
                          {m === 'bank' ? 'Bank' : 'Mobile Money'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                    {payoutMethod === 'bank' ? 'Bank' : 'Network'}
                  </Text>
                  <View style={{ marginTop: 4 }}>
                    <ModalPicker
                      value={bankCode}
                      onSelect={setBankCode}
                      placeholder={`Select ${payoutMethod === 'bank' ? 'bank' : 'network'}`}
                      disabled={payoutMethod === 'bank' && loadingBanks}
                      options={networkOptions.map((b) => ({ label: b.name, value: b.code }))}
                    />
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 12 }}>
                    {payoutMethod === 'bank' ? 'Account number' : 'Mobile Money number'}
                  </Text>
                  <TextInput
                    value={accountNumber}
                    onChangeText={(v) => setAccountNumber(v.replace(/\D/g,''))}
                    placeholder={payoutMethod === 'bank' ? '0123456789' : '0551234567'}
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    style={[inputStyle, { paddingLeft: 16, marginTop: 4 }]}
                  />
                  {accountTaken ? (
                    <Text style={{ fontSize: 12, marginTop: 4, color: colors.error }}>
                      An account with this number already exists. Use a different account.
                    </Text>
                  ) : validationResult.message ? (
                    <Text style={{ fontSize: 12, marginTop: 4, color: validationResult.type === 'success' ? colors.success : colors.error }}>
                      {validationResult.message}
                    </Text>
                  ) : null}

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 12 }}>
                    {payoutMethod === 'bank' ? 'Account name (as on bank statement)' : 'Account holder name'}
                  </Text>
                  <TextInput
                    value={accountName}
                    onChangeText={(v) => setAccountName(v.toUpperCase())}
                    placeholder="KWAME ASANTE"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="characters"
                    style={[inputStyle, { paddingLeft: 16, marginTop: 4 }]}
                  />
                </View>
              )}

              {/* Password */}
              <Text style={labelStyle}>Password</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Lock size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
                  secureTextEntry={!showPassword}
                  style={[inputStyle, { paddingRight: 40 }]}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={16} color={colors.textFaint} /> : <Eye size={16} color={colors.textFaint} />}
                </Pressable>
              </View>
              <PasswordStrength password={form.password} />

              {/* Confirm */}
              <Text style={labelStyle}>Confirm Password</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Lock size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.confirm_password}
                  onChangeText={(v) => setForm({ ...form, confirm_password: v })}
                  secureTextEntry={!showPassword}
                  style={inputStyle}
                />
              </View>

              {/* Terms */}
              <Pressable
                onPress={() => setAgreedToTerms((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}
              >
                <View style={{
                  width: 18, height: 18, borderRadius: 4,
                  borderWidth: 1.5, borderColor: agreedToTerms ? colors.brand : colors.textFaint,
                  backgroundColor: agreedToTerms ? colors.brand : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {agreedToTerms && <Text style={{ color: colors.textOnGold, fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                  I confirm that the details I've provided are accurate, and I agree to the{' '}
                  <Text style={{ color: colors.brand, fontWeight: '600' }}>Terms of Service</Text> and{' '}
                  <Text style={{ color: colors.brand, fontWeight: '600' }}>Privacy Policy</Text>.
                </Text>
              </Pressable>

              <Pressable
                onPress={onSubmit}
                disabled={loading || !agreedToTerms}
                style={{
                  marginTop: 16, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: colors.brand, alignItems: 'center',
                  opacity: loading || !agreedToTerms ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Text>
              </Pressable>

              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>
                  Already have an account?{' '}
                  <Text
                    onPress={() => router.push('/login')}
                    style={{ color: colors.brand, fontWeight: '600' }}
                  >
                    Log in
                  </Text>
                </Text>
              </View>
            </View>

          </View>
        </ScrollView>

        {showLocationPicker && (
          <LocationPickerModal
            colors={colors}
            initial={buyerCoords}
            onCancel={() => setShowLocationPicker(false)}
            onConfirm={(pos: { lat: number; lng: number }) => {
              setBuyerCoords(pos);
              setLocationSource('map');
              const s = findNearestSchool(pos.lat, pos.lng);
              setBuyerSchool(s);
              describePlace(pos, s);
              setShowLocationPicker(false);
            }}
          />
        )}

        {/* Floating back button */}
        <Pressable
          onPress={() => router.replace('/')}
          style={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 100,
          }}
        >
          <ArrowLeft size={16} color={colors.textOnGold} />
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}