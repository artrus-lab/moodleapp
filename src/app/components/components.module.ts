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

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { CoreDownloadRefreshComponent } from './download-refresh/download-refresh';
import { CoreFileComponent } from './file/file';
import { CoreIconComponent } from './icon/icon';
import { CoreIframeComponent } from './iframe/iframe';
import { CoreInputErrorsComponent } from './input-errors/input-errors';
import { CoreLoadingComponent } from './loading/loading';
import { CoreMarkRequiredComponent } from './mark-required/mark-required';
import { CoreRecaptchaComponent } from './recaptcha/recaptcha';
import { CoreRecaptchaModalComponent } from './recaptcha/recaptchamodal';
import { CoreShowPasswordComponent } from './show-password/show-password';
import { CoreEmptyBoxComponent } from './empty-box/empty-box';
import { CoreTabsComponent } from './tabs/tabs';

import { CoreDirectivesModule } from '@app/directives/directives.module';
import { CorePipesModule } from '@app/pipes/pipes.module';

@NgModule({
    declarations: [
        CoreDownloadRefreshComponent,
        CoreFileComponent,
        CoreIconComponent,
        CoreIframeComponent,
        CoreInputErrorsComponent,
        CoreLoadingComponent,
        CoreMarkRequiredComponent,
        CoreRecaptchaComponent,
        CoreRecaptchaModalComponent,
        CoreShowPasswordComponent,
        CoreEmptyBoxComponent,
        CoreTabsComponent,
    ],
    imports: [
        CommonModule,
        IonicModule.forRoot(),
        TranslateModule.forChild(),
        CoreDirectivesModule,
        CorePipesModule,
    ],
    exports: [
        CoreDownloadRefreshComponent,
        CoreFileComponent,
        CoreIconComponent,
        CoreIframeComponent,
        CoreInputErrorsComponent,
        CoreLoadingComponent,
        CoreMarkRequiredComponent,
        CoreRecaptchaComponent,
        CoreRecaptchaModalComponent,
        CoreShowPasswordComponent,
        CoreEmptyBoxComponent,
        CoreTabsComponent,
    ],
})
export class CoreComponentsModule {}
