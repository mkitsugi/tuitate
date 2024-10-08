import { AdMob, AdmobConsentStatus, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

function isMobile() {
    return Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android';
}

function Platform() {
    return Capacitor.getPlatform();
}

export async function initializeAdMob() {
    if (!isMobile()) { return; }
    console.log('Initializing AdMob');
    try {
        await AdMob.initialize();

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
    if (!isMobile()) { return; }
    try {
        const options: BannerAdOptions = {
            adId: Platform() === 'ios' ? 'ca-app-pub-3928514295615403/1779729020' : 'ca-app-pub-3928514295615403/8515160788', // Test ad unit ID
            adSize: BannerAdSize.BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 60
        };
        AdMob.showBanner(options);

    } catch (error) {
        console.error('Error showing banner ad:', error);
    }
}

export async function hideBannerAd() {
    if (!isMobile()) { return; }
    try {
        await AdMob.hideBanner();
        await AdMob.removeBanner();
    } catch (error) {
        console.error('Error hiding banner ad:', error);
    }
}