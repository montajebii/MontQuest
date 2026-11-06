import React, { Component, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Crash guard (device-QA fix): catches render errors anywhere below the
 * navigator (e.g. malformed legacy DB rows) and shows a recoverable
 * pixel-styled screen instead of the red crash screen. The error is
 * logged to the console for adb logcat reporting.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MontQuest] render crash:', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <View style={styles.container}>
        <Text style={styles.title}>آخ! خطای غیرمنتظره</Text>
        <Text style={styles.message} numberOfLines={4}>
          {this.state.message}
        </Text>
        <Text style={styles.hint}>
          این خطا در logcat ثبت شده — با اجرای دوباره اپ یا دکمهٔ زیر ادامه دهید.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="تلاش مجدد برای رندر صفحه"
          onPress={this.handleRetry}>
          <Text style={styles.retryTxt}>تلاش مجدد</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#e8283c', fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold' },
  message: {
    color: '#f8f8f8',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  hint: { color: '#888', fontFamily: 'monospace', fontSize: 11, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 20,
    borderWidth: 3,
    borderColor: '#0ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  retryTxt: { color: '#0ff', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
});

export default ErrorBoundary;
