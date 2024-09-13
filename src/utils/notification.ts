import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

export const initializePushNotifications = async () => {
    await registerPushNotifications();
    await setupFCMListeners();
};

const registerPushNotifications = async () => {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        throw new Error('プッシュ通知の権限が拒否されました。');
    }

    await PushNotifications.register();
};

const setupFCMListeners = async () => {
    await FirebaseMessaging.addListener('notificationReceived', (notification) => {
        console.log('FCM通知を受信しました:', notification);
        // 通知を受信したときの処理をここに追加
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
        console.log('FCM通知のアクションが実行されました:', action);
        // 通知のアクションが実行されたときの処理をここに追加
    });
};

export const getFCMToken = async (): Promise<string> => {
    const result = await FirebaseMessaging.getToken();
    console.log('FCMトークン:', result.token);
    return result.token;
};

// 必要に応じて、トークンをサーバーに送信する関数
export const sendFCMTokenToServer = async (token: string) => {
    // ここでトークンをサーバーに送信する処理を実装
    console.log('FCMトークンをサーバーに送信:', token);
};