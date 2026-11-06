import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import PixelButton from '../components/PixelButton';
import { addQuest } from '../db/quests';
import {
  getCurrentLocation,
  getDefaultRadiusMeters,
  syncGeofences,
} from '../services/locationService';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from '../utils/constants';

/**
 * Add-quest form (spec §4, step 10-6): title, task, location picked on the
 * map (tap to place the marker), and a geofence radius with a live preview.
 */
const AddQuestScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [coord, setCoord] = useState({
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
  });
  const [radius, setRadius] = useState('');
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      setRadius(String(await getDefaultRadiusMeters()));
      try {
        const pos = await getCurrentLocation();
        setCoord(pos);
        mapRef.current?.animateToRegion(
          { ...pos, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          500,
        );
      } catch {}
    })();
  }, []);

  const radiusN = parseFloat(radius);

  const moveTo = (lat: number, lng: number) => {
    setCoord({ latitude: lat, longitude: lng });
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500,
    );
  };

  const handleUseMyLocation = async () => {
    try {
      const pos = await getCurrentLocation();
      moveTo(pos.latitude, pos.longitude);
    } catch (e) {
      Alert.alert('خطا', 'دریافت موقعیت فعلی ناموفق بود — روی نقشه انتخاب کنید');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !task.trim()) {
      Alert.alert('خطا', 'عنوان و شرح الزامی است');
      return;
    }
    if (!Number.isFinite(radiusN) || radiusN <= 0) {
      Alert.alert('خطا', 'شعاع باید عددی مثبت باشد');
      return;
    }
    try {
      await addQuest({
        title: title.trim(),
        task: task.trim(),
        latitude: coord.latitude,
        longitude: coord.longitude,
        radius: radiusN,
      });
      await syncGeofences();
      navigation.goBack();
    } catch (e) {
      Alert.alert('خطا', 'ذخیره کوئست انجام نشد');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>عنوان</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>شرح کار</Text>
      <TextInput style={styles.input} value={task} onChangeText={setTask} multiline />

      <Text style={styles.label}>موقعیت روی نقشه (برای انتخاب، روی نقشه بزنید)</Text>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: DEFAULT_LATITUDE,
          longitude: DEFAULT_LONGITUDE,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e) => setCoord(e.nativeEvent.coordinate)}>
        <Marker coordinate={coord} />
        {Number.isFinite(radiusN) && radiusN > 0 && (
          <Circle
            center={coord}
            radius={radiusN}
            strokeWidth={2}
            strokeColor="#0ff"
            fillColor="rgba(0,255,255,0.08)"
          />
        )}
      </MapView>

      <View style={styles.radiusRow}>
        <View style={styles.radiusField}>
          <Text style={styles.label}>شعاع (متر)</Text>
          <TextInput
            style={styles.input}
            value={radius}
            onChangeText={setRadius}
            keyboardType="numeric"
          />
        </View>
        <PixelButton title="موقعیت من" onPress={handleUseMyLocation} style={styles.locBtn} />
      </View>

      <PixelButton title="ذخیره" onPress={handleSave} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  label: { color: '#0ff', fontFamily: 'monospace', marginTop: 12 },
  input: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 2,
    color: '#fff',
    fontFamily: 'monospace',
    padding: 8,
    marginTop: 4,
  },
  map: { height: 260, marginTop: 6, borderWidth: 2, borderColor: '#fff' },
  radiusRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 12 },
  radiusField: { flex: 1 },
  locBtn: { marginBottom: 6 },
});

export default AddQuestScreen;
