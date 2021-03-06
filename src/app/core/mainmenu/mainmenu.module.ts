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

import { CoreComponentsModule } from '@components/components.module';
import { CoreDirectivesModule } from '@directives/directives.module';

import { CoreMainMenuDelegate } from './services/delegate';

import { CoreMainMenuRoutingModule } from './mainmenu-routing.module';
import { CoreMainMenuPage } from './pages/menu/menu.page';
import { CoreMainMenuMorePage } from './pages/more/more.page';
import { CoreHomeMainMenuHandler } from './handlers/mainmenu';


@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        CoreMainMenuRoutingModule,
        TranslateModule.forChild(),
        CoreComponentsModule,
        CoreDirectivesModule,
    ],
    declarations: [
        CoreMainMenuPage,
        CoreMainMenuMorePage,
    ],
})
export class CoreMainMenuModule {

    constructor(mainMenuDelegate: CoreMainMenuDelegate) {
        mainMenuDelegate.registerHandler(new CoreHomeMainMenuHandler());
    }

}
