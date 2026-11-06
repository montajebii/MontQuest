import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface SearchHit {
  name: string;
  latitude: number;
  longitude: number;
}

interface Props {
  /** Called with the chosen result — the parent flies the camera there. */
  onPick: (hit: SearchHit) => void;
}

/**
 * Place search over the free Nominatim (OpenStreetMap) API. Runs on
 * submit only (Nominatim's usage policy forbids autocomplete-style
 * request storms). Results are capped at 5.
 */
const MapSearch = ({ onPick }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) {return;}
    setBusy(true);
    setResults([]);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' +
        encodeURIComponent(q);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MontQuest/1.0 (offline quest game)' },
      });
      if (!response.ok) {throw new Error(`nominatim ${response.status}`);}
      const json = (await response.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;
      setResults(
        json.map((hit) => ({
          name: hit.display_name,
          latitude: parseFloat(hit.lat),
          longitude: parseFloat(hit.lon),
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, [query, busy]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="جستجوی مکان…"
          placeholderTextColor="#999"
          returnKeyType="search"
          onSubmitEditing={runSearch}
          accessibilityLabel="جستجوی مکان روی نقشه"
        />
        <TouchableOpacity
          style={styles.goBtn}
          accessibilityRole="button"
          accessibilityLabel="اجرای جستجو"
          onPress={runSearch}>
          <Text style={styles.goTxt}>{busy ? '…' : '🔍'}</Text>
        </TouchableOpacity>
      </View>
      {busy && <ActivityIndicator style={styles.spinner} color="#0b0b12" />}
      {results.length > 0 && (
        <ScrollView style={styles.results} nestedScrollEnabled>
          {results.map((hit, i) => (
            <TouchableOpacity
              key={`${hit.latitude},${hit.longitude},${i}`}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`پرواز به ${hit.name}`}
              onPress={() => {
                setResults([]);
                onPick(hit);
              }}>
              <Text style={styles.resultTxt} numberOfLines={2}>
                {hit.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 8, left: 8, right: 8 },
  bar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#0b0b12',
  },
  input: {
    flex: 1,
    color: '#0b0b12',
    fontFamily: 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  goBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderLeftColor: '#0b0b12',
  },
  goTxt: { fontSize: 16 },
  spinner: { marginTop: 6 },
  results: {
    marginTop: 4,
    maxHeight: 180,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#0b0b12',
  },
  resultRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  resultTxt: { color: '#0b0b12', fontFamily: 'monospace', fontSize: 12 },
});

export default MapSearch;
