import { useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Modal, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

const DEFAULT_CENTER = { lat: 6.6885, lng: -1.6244 }; // change to your campus

export default function LocationPickerModal({ colors, initial, onCancel, onConfirm }: any) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const timer = useRef<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number }>(initial || DEFAULT_CENTER);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async (q: string) => {
    if (!q.trim()) return setResults([]);
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=gh&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'CampusCart' } }
      );
      setResults((await res.json()) || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 500);
  };

  const pick = (r: any) => {
    const next = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setPos(next);
    setQuery(r.display_name);
    setResults([]);
    mapRef.current?.animateToRegion(
      { latitude: next.lat, longitude: next.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.card }}>
        <Pressable
          onPress={Keyboard.dismiss}
          style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Set service location</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            Search for your place, or tap anywhere on the map to drop a pin precisely.
          </Text>
          <View style={{ marginTop: 12 }}>
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Street Name / Popular campus location"
              placeholderTextColor={colors.textFaint}
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 13,
              }}
            />
            {searching && (
              <ActivityIndicator
                size="small"
                color={colors.brand}
                style={{ position: 'absolute', right: 12, top: 12 }}
              />
            )}
            {results.length > 0 && (
              <View
                style={{
                  marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                  backgroundColor: colors.card, maxHeight: 190, overflow: 'hidden',
                }}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {results.map((r) => (
                    <Pressable
                      key={r.place_id}
                      onPress={() => pick(r)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 10,
                        borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.text }}>{r.display_name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </Pressable>

        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: pos.lat,
            longitude: pos.lng,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setPos({ lat: latitude, lng: longitude });
          }}
        >
          <Marker coordinate={{ latitude: pos.lat, longitude: pos.lng }} />
        </MapView>

        <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: insets.bottom + 16 }}>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12,
              borderWidth: 1, borderColor: colors.border, alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(pos)}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: colors.brand, alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.textOnGold, fontWeight: '600', fontSize: 14 }}>Confirm pin</Text>
          </Pressable>
        </View>
      </View>
      
    </Modal>
  );
}