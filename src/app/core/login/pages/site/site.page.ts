// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { NavController } from '@ionic/angular';

import { CoreApp } from '@services/app';
import { CoreConfig } from '@services/config';
import { CoreSites, CoreSiteCheckResponse, CoreLoginSiteInfo, CoreSitesDemoSiteData } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreLoginHelper, CoreLoginHelperProvider } from '@core/login/services/helper';
import { CoreSite } from '@classes/site';
import { CoreError } from '@classes/errors/error';
import { CoreConstants } from '@core/constants';
import { Translate, ModalController } from '@singletons/core.singletons';
import { CoreUrl } from '@singletons/url';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreLoginSiteHelpComponent } from '@core/login/components/site-help/site-help';
import { CoreLoginSiteOnboardingComponent } from '@core/login/components/site-onboarding/site-onboarding';

/**
 * Page that displays a "splash screen" while the app is being initialized.
 */
@Component({
    selector: 'page-core-login-site',
    templateUrl: 'site.html',
    styleUrls: ['site.scss', '../../login.scss'],
})
export class CoreLoginSitePage implements OnInit {

    @ViewChild('siteFormEl') formElement?: ElementRef;

    siteForm: FormGroup;
    fixedSites?: CoreLoginSiteInfoExtended[];
    filteredSites?: CoreLoginSiteInfoExtended[];
    siteSelector = 'sitefinder';
    showKeyboard = false;
    filter = '';
    sites: CoreLoginSiteInfoExtended[] = [];
    hasSites = false;
    loadingSites = false;
    searchFunction: (search: string) => void;
    showScanQR: boolean;
    enteredSiteUrl?: CoreLoginSiteInfoExtended;
    siteFinderSettings: SiteFinderSettings;

    constructor(
        protected route: ActivatedRoute,
        protected formBuilder: FormBuilder,
        protected navCtrl: NavController,
    ) {

        let url = '';
        this.siteSelector = CoreConstants.CONFIG.multisitesdisplay;

        const siteFinderSettings: Partial<SiteFinderSettings> = CoreConstants.CONFIG.sitefindersettings || {};
        this.siteFinderSettings = {
            displaysitename: true,
            displayimage: true,
            displayalias: true,
            displaycity: true,
            displaycountry: true,
            displayurl: true,
            ...siteFinderSettings,
        };

        // Load fixed sites if they're set.
        if (CoreLoginHelper.instance.hasSeveralFixedSites()) {
            url = this.initSiteSelector();
        } else if (CoreConstants.CONFIG.enableonboarding && !CoreApp.instance.isIOS()) {
            this.initOnboarding();
        }

        this.showScanQR = CoreUtils.instance.canScanQR() && (typeof CoreConstants.CONFIG.displayqronsitescreen == 'undefined' ||
            !!CoreConstants.CONFIG.displayqronsitescreen);

        this.siteForm = this.formBuilder.group({
            siteUrl: [url, this.moodleUrlValidator()],
        });

        this.searchFunction = CoreUtils.instance.debounce(async (search: string) => {
            search = search.trim();

            if (search.length >= 3) {
                // Update the sites list.
                const sites = await CoreSites.instance.findSites(search);

                // Add UI tweaks.
                this.sites = this.extendCoreLoginSiteInfo(<CoreLoginSiteInfoExtended[]> sites);

                this.hasSites = !!this.sites.length;
            } else {
                // Not reseting the array to allow animation to be displayed.
                this.hasSites = false;
            }

            this.loadingSites = false;
        }, 1000);
    }

    /**
     * Initialize the component.
     */
    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            this.showKeyboard = !!params['showKeyboard'];
        });
    }

    /**
     * Initialize the site selector.
     *
     * @return URL of the first site.
     */
    protected initSiteSelector(): string {
        // Deprecate listnourl on 3.9.3, remove this block on the following release.
        if (this.siteSelector == 'listnourl') {
            this.siteSelector = 'list';
            this.siteFinderSettings.displayurl = false;
        }

        this.fixedSites = this.extendCoreLoginSiteInfo(<CoreLoginSiteInfoExtended[]> CoreLoginHelper.instance.getFixedSites());

        // Do not show images if none are set.
        if (!this.fixedSites.some((site) => !!site.imageurl)) {
            this.siteFinderSettings.displayimage = false;
        }

        // Autoselect if not defined.
        if (this.siteSelector != 'list' && this.siteSelector != 'buttons') {
            this.siteSelector = this.fixedSites.length > 3 ? 'list' : 'buttons';
        }

        this.filteredSites = this.fixedSites;

        return this.fixedSites[0].url;
    }

    /**
     * Initialize and show onboarding if needed.
     *
     * @return Promise resolved when done.
     */
    protected async initOnboarding(): Promise<void> {
        const onboardingDone = await CoreConfig.instance.get(CoreLoginHelperProvider.ONBOARDING_DONE, false);

        if (!onboardingDone) {
            // Check onboarding.
            this.showOnboarding();
        }
    }

    /**
     * Extend info of Login Site Info to get UI tweaks.
     *
     * @param  sites Sites list.
     * @return Sites list with extended info.
     */
    protected extendCoreLoginSiteInfo(sites: CoreLoginSiteInfoExtended[]): CoreLoginSiteInfoExtended[] {
        return sites.map((site) => {
            site.noProtocolUrl = this.siteFinderSettings.displayurl && site.url ? CoreUrl.removeProtocol(site.url) : '';

            const name = this.siteFinderSettings.displaysitename ? site.name : '';
            const alias = this.siteFinderSettings.displayalias && site.alias ? site.alias : '';

            // Set title with parenthesis if both name and alias are present.
            site.title = name && alias ? name + ' (' + alias + ')' : name + alias;

            const country = this.siteFinderSettings.displaycountry && site.countrycode ?
                CoreUtils.instance.getCountryName(site.countrycode) : '';
            const city = this.siteFinderSettings.displaycity && site.city ?
                site.city : '';

            // Separate location with hiphen if both country and city are present.
            site.location = city && country ? city + ' - ' + country : city + country;

            return site;
        });
    }

    /**
     * Validate Url.
     *
     * @return {ValidatorFn} Validation results.
     */
    protected moodleUrlValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const value = control.value.trim();
            let valid = value.length >= 3 && CoreUrl.isValidMoodleUrl(value);

            if (!valid) {
                const demo = !!CoreSites.instance.getDemoSiteData(value);

                if (demo) {
                    valid = true;
                }
            }

            return valid ? null : { siteUrl: { value: control.value } };
        };
    }

    /**
     * Show a help modal.
     */
    async showHelp(): Promise<void> {
        const modal = await ModalController.instance.create({
            component: CoreLoginSiteHelpComponent,
            cssClass: 'core-modal-fullscreen',
        });

        await modal.present();
    }

    /**
     * Show an onboarding modal.
     */
    async showOnboarding(): Promise<void> {
        const modal = await ModalController.instance.create({
            component: CoreLoginSiteOnboardingComponent,
            cssClass: 'core-modal-fullscreen',
        });

        await modal.present();
    }

    /**
     * Try to connect to a site.
     *
     * @param e Event.
     * @param url The URL to connect to.
     * @param foundSite The site clicked, if any, from the found sites list.
     * @return Promise resolved when done.
     */
    async connect(e: Event, url: string, foundSite?: CoreLoginSiteInfoExtended): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        CoreApp.instance.closeKeyboard();

        if (!url) {
            CoreDomUtils.instance.showErrorModal('core.login.siteurlrequired', true);

            return;
        }

        if (!CoreApp.instance.isOnline()) {
            CoreDomUtils.instance.showErrorModal('core.networkerrormsg', true);

            return;
        }

        url = url.trim();

        if (url.match(/^(https?:\/\/)?campus\.example\.edu/)) {
            this.showLoginIssue(null, new CoreError(Translate.instance.instant('core.login.errorexampleurl')));

            return;
        }

        const siteData = CoreSites.instance.getDemoSiteData(url);

        if (siteData) {
            // It's a demo site.
            await this.loginDemoSite(siteData);

        } else {
            // Not a demo site.
            const modal = await CoreDomUtils.instance.showModalLoading();

            let checkResult: CoreSiteCheckResponse;

            try {
                checkResult = await CoreSites.instance.checkSite(url);
            } catch (error) {
                // Attempt guessing the domain if the initial check failed
                const domain = CoreUrl.guessMoodleDomain(url);

                if (domain && domain != url) {
                    try {
                        checkResult = await CoreSites.instance.checkSite(domain);
                    } catch (secondError) {
                        // Try to use the first error.
                        modal.dismiss();

                        return this.showLoginIssue(url, error || secondError);
                    }
                } else {
                    modal.dismiss();

                    return this.showLoginIssue(url, error);
                }
            }

            await this.login(checkResult, foundSite);

            modal.dismiss();
        }
    }

    /**
     * Authenticate in a demo site.
     *
     * @param siteData Site data.
     * @return Promise resolved when done.
     */
    protected async loginDemoSite(siteData: CoreSitesDemoSiteData): Promise<void> {
        const modal = await CoreDomUtils.instance.showModalLoading();

        try {
            const data = await CoreSites.instance.getUserToken(siteData.url, siteData.username, siteData.password);

            await CoreSites.instance.newSite(data.siteUrl, data.token, data.privateToken);

            CoreDomUtils.instance.triggerFormSubmittedEvent(this.formElement, true);

            return CoreLoginHelper.instance.goToSiteInitialPage();
        } catch (error) {
            CoreLoginHelper.instance.treatUserTokenError(siteData.url, error, siteData.username, siteData.password);

            if (error.loggedout) {
                this.navCtrl.navigateRoot('/login/sites');
            }
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Process login to a site.
     *
     * @param response Response obtained from the site check request.
     * @param foundSite The site clicked, if any, from the found sites list.
     *
     * @return Promise resolved after logging in.
     */
    protected async login(response: CoreSiteCheckResponse, foundSite?: CoreLoginSiteInfoExtended): Promise<void> {
        await CoreUtils.instance.ignoreErrors(CoreSites.instance.checkApplication(response));

        CoreDomUtils.instance.triggerFormSubmittedEvent(this.formElement, true);

        if (response.warning) {
            CoreDomUtils.instance.showErrorModal(response.warning, true, 4000);
        }

        if (CoreLoginHelper.instance.isSSOLoginNeeded(response.code)) {
            // SSO. User needs to authenticate in a browser.
            CoreLoginHelper.instance.confirmAndOpenBrowserForSSOLogin(
                response.siteUrl,
                response.code,
                response.service,
                response.config?.launchurl,
            );
        } else {
            const pageParams = { siteUrl: response.siteUrl, siteConfig: response.config };
            if (foundSite && !this.fixedSites) {
                pageParams['siteName'] = foundSite.name;
                pageParams['logoUrl'] = foundSite.imageurl;
            }

            this.navCtrl.navigateForward('/login/credentials', {
                queryParams: pageParams,
            });
        }
    }

    /**
     * Show an error that aims people to solve the issue.
     *
     * @param url The URL the user was trying to connect to.
     * @param error Error to display.
     */
    protected showLoginIssue(url: string | null, error: CoreError): void {
        let errorMessage = CoreDomUtils.instance.getErrorMessage(error);

        if (errorMessage == Translate.instance.instant('core.cannotconnecttrouble')) {
            const found = this.sites.find((site) => site.url == url);

            if (!found) {
                errorMessage += ' ' + Translate.instance.instant('core.cannotconnectverify');
            }
        }

        let message = '<p>' + errorMessage + '</p>';
        if (url) {
            const fullUrl = CoreUrlUtils.instance.isAbsoluteURL(url) ? url : 'https://' + url;
            message += '<p padding><a href="' + fullUrl + '" core-link>' + url + '</a></p>';
        }

        const buttons = [
            {
                text: Translate.instance.instant('core.needhelp'),
                handler: (): void => {
                    this.showHelp();
                },
            },
            {
                text: Translate.instance.instant('core.tryagain'),
                role: 'cancel',
            },
        ];

        // @TODO: Remove CoreSite.MINIMUM_MOODLE_VERSION, not used on translations since 3.9.0.
        CoreDomUtils.instance.showAlertWithOptions({
            header: Translate.instance.instant('core.cannotconnect', { $a: CoreSite.MINIMUM_MOODLE_VERSION }),
            message,
            buttons,
        });
    }

    /**
     * The filter has changed.
     *
     * @param event Received Event.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterChanged(event?: any): void {
        const newValue = event?.target.value?.trim().toLowerCase();
        if (!newValue || !this.fixedSites) {
            this.filteredSites = this.fixedSites;
        } else {
            this.filteredSites = this.fixedSites.filter((site) =>
                site.title.toLowerCase().indexOf(newValue) > -1 || site.noProtocolUrl.toLowerCase().indexOf(newValue) > -1 ||
                site.location.toLowerCase().indexOf(newValue) > -1);
        }
    }

    /**
     * Find a site on the backend.
     *
     * @param e Event.
     * @param search Text to search.
     */
    searchSite(e: Event, search: string): void {
        this.loadingSites = true;

        search = search.trim();

        if (this.siteForm.valid && search.length >= 3) {
            this.enteredSiteUrl = {
                url: search,
                name: 'connect',
                title: '',
                location: '',
                noProtocolUrl: CoreUrl.removeProtocol(search),
            };
        } else {
            this.enteredSiteUrl = undefined;
        }

        this.searchFunction(search.trim());
    }

    /**
     * Show instructions and scan QR code.
     */
    showInstructionsAndScanQR(): void {
        // Show some instructions first.
        CoreDomUtils.instance.showAlertWithOptions({
            header: Translate.instance.instant('core.login.faqwhereisqrcode'),
            message: Translate.instance.instant(
                'core.login.faqwhereisqrcodeanswer',
                { $image: CoreLoginHelperProvider.FAQ_QRCODE_IMAGE_HTML },
            ),
            buttons: [
                {
                    text: Translate.instance.instant('core.cancel'),
                    role: 'cancel',
                },
                {
                    text: Translate.instance.instant('core.next'),
                    handler: (): void => {
                        this.scanQR();
                    },
                },
            ],
        });
    }

    /**
     * Scan a QR code and put its text in the URL input.
     *
     * @return Promise resolved when done.
     */
    async scanQR(): Promise<void> {
        // Scan for a QR code.
        const text = await CoreUtils.instance.scanQR();

        if (text) {
            // @todo
        }
    }

}

/**
 * Extended data for UI implementation.
 */
type CoreLoginSiteInfoExtended = CoreLoginSiteInfo & {
    noProtocolUrl: string; // Url wihtout protocol.
    location: string; // City + country.
    title: string; // Name + alias.
};

type SiteFinderSettings = {
    displayalias: boolean;
    displaycity: boolean;
    displaycountry: boolean;
    displayimage: boolean;
    displaysitename: boolean;
    displayurl: boolean;
};
