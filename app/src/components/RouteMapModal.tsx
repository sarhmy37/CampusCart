import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { X, Navigation } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Pt = { lat: number; lng: number };

export default function RouteMapModal({
  visible, onClose, destination, title,
}: { visible: boolean; onClose: () => void; destination: Pt | null; title?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [me, setMe] = useState<Pt | null>(null);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !destination) return;
    let cancelled = false;
    (async () => {
      setBusy(true); setError(''); setRoute([]); setMe(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setError('Location permission needed to show the route.'); return; }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (cancelled) return;
        setMe(from);
        const res = await fetch(
          `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
        );
        const json = await res.json();
        const coords = json?.routes?.[0]?.geometry?.coordinates;
        if (cancelled || !coords?.length) return;
        const line = coords.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
        setRoute(line);
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(line, {
            edgePadding: { top: 100, right: 60, bottom: 120, left: 60 },
            animated: true,
          });
        }, 400);
      } catch {
        if (!cancelled) setError("Couldn't get the route. Check your connection.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, destination?.lat, destination?.lng]);

  if (!destination) return null;

  const openGoogle = () =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1${me ? `&origin=${me.lat},${me.lng}` : ''}&destination=${destination.lat},${destination.lng}&travelmode=walking`
    );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{ latitude: destination.lat, longitude: destination.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        >
          {route.length > 0 && <Polyline coordinates={route} strokeColor={colors.brand} strokeWidth={4} />}
          <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title={title} />
          {me && <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} title="You" pinColor="#3b82f6" />}
        </MapView>

        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute', top: insets.top + 12, right: 16,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.95)',
          }}
        >
          <X size={14} color="#0f172a" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>Minimize</Text>
        </Pressable>

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 8 }}>
          {(busy || !!error) && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {busy && <ActivityIndicator size="small" color={colors.brand} />}
              <Text style={{ flex: 1, fontSize: 12, color: '#0f172a' }}>{busy ? 'Finding your route…' : error}</Text>
            </View>
          )}
          <Pressable
            onPress={openGoogle}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand }}
          >
            <Navigation size={15} color={colors.textOnGold} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>Open in Google Maps</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}