import { AdMob, AdmobConsentStatus, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

export async function initializeAdMob() {
    console.log('Initializing AdMob');
    try {
        await AdMob.initialize({ initializeForTesting: true });

        console.log('Requesting tracking and consent info');
        const trackingInfo = await AdMob.trackingAuthorizationStatus();
        console.log('Tracking info:', trackingInfo);

        let consentInfo;
        try {
            consentInfo = await AdMob.requestConsentInfo();
            console.log('Consent info:', consentInfo);
        } catch (error) {
            console.error('Error requesting consent info:', error);
            // Continue with the rest of the initialization process
        }

        if (trackingInfo.status === 'notDetermined') {
            console.log('Requesting tracking authorization');
            await AdMob.requestTrackingAuthorization();
        }

        console.log('Getting final authorization status');
        const authorizationStatus = await AdMob.trackingAuthorizationStatus();
        console.log('Final authorization status:', authorizationStatus);

        if (
            authorizationStatus.status === 'authorized' &&
            consentInfo &&
            consentInfo.isConsentFormAvailable &&
            consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
            console.log('Showing consent form');
            await AdMob.showConsentForm();
        }

        console.log('AdMob initialization complete');
    } catch (error) {
        console.error('Error during AdMob initialization:', error);
    }
}


export async function showBannerAd() {
    try {
        const options: BannerAdOptions = {
            adId: 'ca-app-pub-3940256099942544/6300978111', // Test ad unit ID
            adSize: BannerAdSize.BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
        };
        AdMob.showBanner(options);

    } catch (error) {
        console.error('Error showing banner ad:', error);
    }
}

export async function hideBannerAd() {
    try {
        await AdMob.hideBanner();
        await AdMob.removeBanner();
    } catch (error) {
        console.error('Error hiding banner ad:', error);
    }
}