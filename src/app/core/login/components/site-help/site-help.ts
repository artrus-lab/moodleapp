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

import { Component } from '@angular/core';

import { CoreUtils } from '@services/utils/utils';
import { ModalController, Translate } from '@singletons/core.singletons';
import { CoreLoginHelperProvider } from '@core/login/services/helper';

/**
 * Component that displays help to connect to a site.
 */
@Component({
    selector: 'core-login-site-help',
    templateUrl: 'site-help.html',
    styleUrls: ['site-help.scss'],
})
export class CoreLoginSiteHelpComponent {

    urlImageHtml: string;
    setupLinkHtml: string;
    qrCodeImageHtml: string;
    canScanQR: boolean;

    constructor() {

        this.canScanQR = CoreUtils.instance.canScanQR();
        this.urlImageHtml = CoreLoginHelperProvider.FAQ_URL_IMAGE_HTML;
        this.qrCodeImageHtml = CoreLoginHelperProvider.FAQ_QRCODE_IMAGE_HTML;
        this.setupLinkHtml = '<a href="https://moodle.com/getstarted/" title="' +
            Translate.instance.instant('core.login.faqsetupsitelinktitle') + '">https://moodle.com/getstarted/</a>';
    }

    /**
     * Close help modal.
     */
    closeHelp(): void {
        ModalController.instance.dismiss();
    }

}
