import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PixelAvatar from '../components/PixelAvatar';
import PixelButton from '../components/PixelButton';
import XPBar from '../components/XPBar';
import { getQuestHistoryWithTitles } from '../db/quests';
import { useGame } from '../state/GameContext';
import { AVATAR_SPRITES, getAvatarTier } from '../utils/avatars';

/**
 * Pixel avatar profile (Could-have #2): the hero evolves every 5 levels
 * (سرگردان → شمشیرزن → نگهبان → قهرمان → پادشاه) plus run stats.
 */
const ProfileScreen = ({ navigation }: any) => {
  const { profile, refreshProfile } = useGame();

  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => {});
    }, [refreshProfile]),
  );

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>پروفایل هنوز آماده نیست.</Text>
      </View>
    );
  }

  const tier = getAvatarTier(profile.level);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}>
      <PixelAvatar level={profile.level} />
      <Text style={styles.tier}>
        رده: {AVATAR_SPRITES[tier].name} — لول {profile.level}
      </Text>
      <Text style={styles.hint}>
        هر ۵ لول، قهرمان شما ارتقا می‌یابد
      </Text>

      <View style={styles.statsBox}>
        <XPBar />
        <Text style={styles.stat}>🪙 سکه‌ها: {profile.coins}</Text>
        <Text style={styles.stat}>مجموع XP: {profile.total_xp}</Text>
        <CompletedStat />
      </View>

      <PixelButton
        title="بازگشت"
        accessibilityLabel="بازگشت به صفحهٔ اصلی"
        onPress={() => navigation.goBack()}
      />
    </ScrollView>
  );
};

const CompletedStat = () => {
  const [count, setCount] = React.useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      getQuestHistoryWithTitles()
        .then((rows) => setCount(rows.length))
        .catch(() => setCount(null));
    }, []),
  );
  return (
    <Text style={styles.stat}>
      کوئست‌های تکمیل‌شده: {count ?? '…'}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, alignItems: 'center' },
  tier: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  hint: { color: '#666', fontFamily: 'monospace', fontSize: 11, marginTop: 4 },
  statsBox: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderColor: '#fff',
    padding: 12,
    marginTop: 16,
  },
  stat: { color: '#fff', fontFamily: 'monospace', fontSize: 14, marginTop: 8 },
  empty: { color: '#aaa', fontFamily: 'monospace', textAlign: 'center', marginTop: 40 },
});

export default ProfileScreen;
