import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import PixelButton from './PixelButton';
import EdgeFlashOverlay from './EdgeFlashOverlay';
import { useProximityMonitor } from '../hooks/useProximityMonitor';

/**
 * App-level "nearby quest" UX (spec §4/§6): blinking edge overlay + the
 * confirmation dialog. Mounted once in App (inside GameProvider) so it is
 * reachable from every screen, not just the map.
 */
const NearbyQuestOverlay = () => {
  const {
    nearbyQuest,
    isDialogVisible,
    confirmEnabled,
    edgeFlash,
    confirm,
    notNow,
  } = useProximityMonitor();

  return (
    <>
      <EdgeFlashOverlay visible={edgeFlash} />
      <Modal
        visible={isDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={notNow}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{nearbyQuest?.title}</Text>
            <Text style={styles.dialogText}>آیا کار این کوئست را انجام دادید؟</Text>
            <PixelButton title="تأیید" disabled={!confirmEnabled} onPress={confirm} />
            <PixelButton title="فعلاً نه" onPress={notNow} />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: '#111', borderColor: '#fff', borderWidth: 3, padding: 16 },
  dialogTitle: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogText: { color: '#fff', fontFamily: 'monospace', fontSize: 16, marginBottom: 12 },
});

export default NearbyQuestOverlay;
