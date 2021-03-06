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

import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnChanges,
    OnDestroy,
    AfterViewInit,
    ViewChild,
    ElementRef,
} from '@angular/core';
import { Platform, IonSlides, IonTabs, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CoreApp } from '@services/app';
import { CoreConfig } from '@services/config';
import { CoreConstants } from '@core/constants';
import { CoreUtils } from '@/app/services/utils/utils';
import { NavigationOptions } from '@ionic/angular/providers/nav-controller';
import { Params } from '@angular/router';

/**
 * This component displays some top scrollable tabs that will autohide on vertical scroll.
 *
 * Example usage:
 *
 * <core-tabs selectedIndex="1" [tabs]="tabs"></core-tabs>
 *
 * Tab contents will only be shown if that tab is selected.
 *
 * @todo: Test behaviour when tabs are added late.
 * @todo: Test RTL and tab history.
 */
@Component({
    selector: 'core-tabs',
    templateUrl: 'core-tabs.html',
    styleUrls: ['tabs.scss'],
})
export class CoreTabsComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {


    // Minimum tab's width to display fully the word "Competencies" which is the longest tab in the app.
    protected static readonly MIN_TAB_WIDTH = 107;
    // Max height that allows tab hiding.
    protected static readonly MAX_HEIGHT_TO_HIDE_TABS = 768;

    @Input() protected selectedIndex = 0; // Index of the tab to select.
    @Input() hideUntil = false; // Determine when should the contents be shown.
    /**
     * Determine tabs layout.
     */
    @Input() layout: 'icon-top' | 'icon-start' | 'icon-end' | 'icon-bottom' | 'icon-hide' | 'label-hide' = 'icon-hide';
    @Input() tabs: CoreTab[] = [];
    @Output() protected ionChange: EventEmitter<CoreTab> = new EventEmitter<CoreTab>(); // Emitted when the tab changes.

    @ViewChild(IonSlides) protected slides?: IonSlides;
    @ViewChild(IonTabs) protected ionTabs?: IonTabs;

    selected?: string; // Selected tab id.
    showPrevButton = false;
    showNextButton = false;
    maxSlides = 3;
    numTabsShown = 0;
    direction = 'ltr';
    description = '';
    lastScroll = 0;
    slideOpts = {
        initialSlide: 0,
        slidesPerView: 3,
        centerInsufficientSlides: true,
    };

    protected initialized = false;
    protected afterViewInitTriggered = false;

    protected tabBarHeight = 0;
    protected tabBarElement?: HTMLIonTabBarElement; // The top tab bar element.
    protected tabsElement?: HTMLIonTabsElement; // The ionTabs native Element.
    protected tabsShown = true;
    protected resizeFunction?: EventListenerOrEventListenerObject;
    protected isDestroyed = false;
    protected isCurrentView = true;
    protected shouldSlideToInitial = false; // Whether we need to slide to the initial slide because it's out of view.
    protected hasSliddenToInitial = false; // Whether we've already slidden to the initial slide or there was no need.
    protected selectHistory: string[] = [];

    protected firstSelectedTab?: string; // ID of the first selected tab to control history.
    protected unregisterBackButtonAction: any;
    protected languageChangedSubscription: Subscription;
    protected isInTransition = false; // Weather Slides is in transition.
    protected slidesSwiper: any;
    protected slidesSwiperLoaded = false;

    constructor(
        protected element: ElementRef,
        platform: Platform,
        translate: TranslateService,
        protected navCtrl: NavController,
    ) {
        this.direction = platform.isRTL ? 'rtl' : 'ltr';

        // Change the side when the language changes.
        this.languageChangedSubscription = translate.onLangChange.subscribe(() => {
            setTimeout(() => {
                this.direction = platform.isRTL ? 'rtl' : 'ltr';
            });
        });
    }

    /**
     * Component being initialized.
     */
    async ngOnInit(): Promise<void> {
        this.tabs.forEach((tab) => {
            this.initTab(tab);
        });
    }

    /**
     * Init tab info.
     *
     * @param tab Tab class.
     */
    protected initTab(tab: CoreTab): void {
        tab.id = tab.id || 'core-tab-' + CoreUtils.instance.getUniqueId('CoreTabsComponent');
        if (typeof tab.enabled == 'undefined') {
            tab.enabled = true;
        }
    }

    /**
     * View has been initialized.
     */
    async ngAfterViewInit(): Promise<void> {
        if (this.isDestroyed) {
            return;
        }

        this.tabBarElement = this.element.nativeElement.querySelector('ion-tab-bar');
        this.tabsElement = this.element.nativeElement.querySelector('ion-tabs');

        this.slidesSwiper = await this.slides?.getSwiper();
        this.slidesSwiper.once('progress', () => {
            this.slidesSwiperLoaded = true;
            this.calculateSlides();
        });

        this.afterViewInitTriggered = true;

        if (!this.initialized && this.hideUntil) {
            // Tabs should be shown, initialize them.
            await this.initializeTabs();
        }

        this.resizeFunction = this.windowResized.bind(this);

        window.addEventListener('resize', this.resizeFunction!);
    }

    /**
     * Detect changes on input properties.
     */
    ngOnChanges(): void {
        this.tabs.forEach((tab) => {
            this.initTab(tab);
        });

        // We need to wait for ngAfterViewInit because we need core-tab components to be executed.
        if (!this.initialized && this.hideUntil && this.afterViewInitTriggered) {
            // Tabs should be shown, initialize them.
            // Use a setTimeout so child core-tab update their inputs before initializing the tabs.
            setTimeout(() => {
                this.initializeTabs();
            });
        }
    }

    /**
     * User entered the page that contains the component.
     */
    ionViewDidEnter(): void {
        this.isCurrentView = true;

        this.calculateSlides();

        this.registerBackButtonAction();
    }

    /**
     * Register back button action.
     */
    protected registerBackButtonAction(): void {
        this.unregisterBackButtonAction = CoreApp.instance.registerBackButtonAction(() => {
            // The previous page in history is not the last one, we need the previous one.
            if (this.selectHistory.length > 1) {
                const tabIndex = this.selectHistory[this.selectHistory.length - 2];

                // Remove curent and previous tabs from history.
                this.selectHistory = this.selectHistory.filter((tabId) => this.selected != tabId && tabIndex != tabId);

                this.selectTab(tabIndex);

                return true;
            } else if (this.selected != this.firstSelectedTab) {
                // All history is gone but we are not in the first selected tab.
                this.selectHistory = [];

                this.selectTab(this.firstSelectedTab!);

                return true;
            }

            return false;
        }, 750);
    }

    /**
     * User left the page that contains the component.
     */
    ionViewDidLeave(): void {
        // Unregister the custom back button action for this page
        this.unregisterBackButtonAction && this.unregisterBackButtonAction();

        this.isCurrentView = false;
    }

    /**
     * Calculate slides.
     */
    protected async calculateSlides(): Promise<void> {
        if (!this.isCurrentView || !this.initialized) {
            // Don't calculate if component isn't in current view, the calculations are wrong.
            return;
        }

        if (!this.tabsShown) {
            if (window.innerHeight >= CoreTabsComponent.MAX_HEIGHT_TO_HIDE_TABS) {
                // Ensure tabbar is shown.
                this.tabsShown = true;
                this.tabBarElement!.classList.remove('tabs-hidden');
                this.lastScroll = 0;
            }
        }

        await this.calculateMaxSlides();

        this.updateSlides();
    }

    /**
     * Calculate the tab bar height.
     */
    protected calculateTabBarHeight(): void {
        if (!this.tabBarElement || !this.tabsElement) {
            return;
        }

        this.tabBarHeight = this.tabBarElement.offsetHeight;

        if (this.tabsShown) {
            // Smooth translation.
            this.tabsElement.style.top = - this.lastScroll + 'px';
            this.tabsElement.style.height = 'calc(100% + ' + scroll + 'px';
        } else {
            this.tabBarElement.classList.add('tabs-hidden');
            this.tabsElement.style.top = '0';
            this.tabsElement.style.height = '';
        }
    }

    /**
     * Get the tab on a index.
     *
     * @param tabId Tab ID.
     * @return Selected tab.
     */
    protected getTabIndex(tabId: string): number {
        return this.tabs.findIndex((tab) => tabId == tab.id);
    }

    /**
     * Get the current selected tab.
     *
     * @return Selected tab.
     */
    getSelected(): CoreTab | undefined {
        const index = this.selected && this.getTabIndex(this.selected);

        return index && index >= 0 ? this.tabs[index] : undefined;
    }

    /**
     * Initialize the tabs, determining the first tab to be shown.
     */
    protected async initializeTabs(): Promise<void> {
        let selectedTab: CoreTab | undefined = this.tabs[this.selectedIndex || 0] || undefined;

        if (!selectedTab || !selectedTab.enabled) {
            // The tab is not enabled or not shown. Get the first tab that is enabled.
            selectedTab = this.tabs.find((tab) => tab.enabled) || undefined;
        }

        if (!selectedTab) {
            return;
        }

        this.firstSelectedTab = selectedTab.id;
        this.selectTab(this.firstSelectedTab);

        // Setup tab scrolling.
        this.calculateTabBarHeight();

        this.initialized = true;

        // Check which arrows should be shown.
        this.calculateSlides();
    }

    /**
     * Method executed when the slides are changed.
     */
    async slideChanged(): Promise<void> {
        if (!this.slidesSwiperLoaded) {
            return;
        }

        this.isInTransition = false;
        const slidesCount = await this.slides?.length() || 0;
        if (slidesCount > 0) {
            this.showPrevButton = !await this.slides?.isBeginning();
            this.showNextButton = !await this.slides?.isEnd();
        } else {
            this.showPrevButton = false;
            this.showNextButton = false;
        }

        const currentIndex = await this.slides!.getActiveIndex();
        if (this.shouldSlideToInitial && currentIndex != this.selectedIndex) {
            // Current tab has changed, don't slide to initial anymore.
            this.shouldSlideToInitial = false;
        }
    }

    /**
     * Updates the number of slides to show.
     */
    protected async updateSlides(): Promise<void> {
        this.numTabsShown = this.tabs.reduce((prev: number, current: CoreTab) => current.enabled ? prev + 1 : prev, 0);

        this.slideOpts.slidesPerView = Math.min(this.maxSlides, this.numTabsShown);
        this.slidesSwiper.params.slidesPerView = this.slideOpts.slidesPerView;

        this.calculateTabBarHeight();
        await this.slides!.update();

        if (!this.hasSliddenToInitial && this.selectedIndex && this.selectedIndex >= this.slideOpts.slidesPerView) {
            this.hasSliddenToInitial = true;
            this.shouldSlideToInitial = true;

            setTimeout(() => {
                if (this.shouldSlideToInitial) {
                    this.slides!.slideTo(this.selectedIndex, 0);
                    this.shouldSlideToInitial = false;
                }
            }, 400);

            return;
        } else if (this.selectedIndex) {
            this.hasSliddenToInitial = true;
        }

        setTimeout(() => {
            this.slideChanged(); // Call slide changed again, sometimes the slide active index takes a while to be updated.
        }, 400);
    }

    /**
     * Calculate the number of slides that can fit on the screen.
     */
    protected async calculateMaxSlides(): Promise<void> {
        if (!this.slidesSwiperLoaded) {
            return;
        }

        this.maxSlides = 3;
        const width = this.slidesSwiper.width;
        if (width) {
            const fontSize = await
            CoreConfig.instance.get(CoreConstants.SETTINGS_FONT_SIZE, CoreConstants.CONFIG.font_sizes[0]);

            this.maxSlides = Math.floor(width / (fontSize / CoreConstants.CONFIG.font_sizes[0] *
                CoreTabsComponent.MIN_TAB_WIDTH));
        }
    }

    /**
     * Method that shows the next tab.
     */
    async slideNext(): Promise<void> {
        // Stop if slides are in transition.
        if (!this.showNextButton || this.isInTransition) {
            return;
        }

        if (await this.slides!.isBeginning()) {
            // Slide to the second page.
            this.slides!.slideTo(this.maxSlides);
        } else {
            const currentIndex = await this.slides!.getActiveIndex();
            if (typeof currentIndex !== 'undefined') {
                const nextSlideIndex = currentIndex + this.maxSlides;
                this.isInTransition = true;
                if (nextSlideIndex < this.numTabsShown) {
                    // Slide to the next page.
                    await this.slides!.slideTo(nextSlideIndex);
                } else {
                    // Slide to the latest slide.
                    await this.slides!.slideTo(this.numTabsShown - 1);
                }
            }

        }
    }

    /**
     * Method that shows the previous tab.
     */
    async slidePrev(): Promise<void> {
        // Stop if slides are in transition.
        if (!this.showPrevButton || this.isInTransition) {
            return;
        }

        if (await this.slides!.isEnd()) {
            this.slides!.slideTo(this.numTabsShown - this.maxSlides * 2);
            // Slide to the previous of the latest page.
        } else {
            const currentIndex = await this.slides!.getActiveIndex();
            if (typeof currentIndex !== 'undefined') {
                const prevSlideIndex = currentIndex - this.maxSlides;
                this.isInTransition = true;
                if (prevSlideIndex >= 0) {
                    // Slide to the previous page.
                    await this.slides!.slideTo(prevSlideIndex);
                } else {
                    // Slide to the first page.
                    await this.slides!.slideTo(0);
                }
            }
        }
    }

    /**
     * Show or hide the tabs. This is used when the user is scrolling inside a tab.
     *
     * @param scrollEvent Scroll event to check scroll position.
     * @param content Content element to check measures.
     */
    protected showHideTabs(scrollEvent: CustomEvent, content: HTMLElement): void {
        if (!this.tabBarElement || !this.tabsElement || !content) {
            return;
        }

        // Always show on very tall screens.
        if (window.innerHeight >= CoreTabsComponent.MAX_HEIGHT_TO_HIDE_TABS) {
            return;
        }

        if (!this.tabBarHeight && this.tabBarElement.offsetHeight != this.tabBarHeight) {
            // Wrong tab height, recalculate it.
            this.calculateTabBarHeight();
        }

        if (!this.tabBarHeight) {
            // We don't have the tab bar height, this means the tab bar isn't shown.
            return;
        }

        const scroll = parseInt(scrollEvent.detail.scrollTop, 10);
        if (scroll <= 0) {
            // Ensure tabbar is shown.
            this.tabsElement.style.top = '0';
            this.tabsElement.style.height = '';
            this.tabBarElement!.classList.remove('tabs-hidden');
            this.tabsShown = true;
            this.lastScroll = 0;

            return;
        }

        if (scroll == this.lastScroll) {
            // Ensure scroll has been modified to avoid flicks.
            return;
        }

        if (this.tabsShown && scroll > this.tabBarHeight) {
            this.tabsShown = false;

            // Hide tabs.
            this.tabBarElement.classList.add('tabs-hidden');
            this.tabsElement.style.top = '0';
            this.tabsElement.style.height = '';
        } else if (!this.tabsShown && scroll <= this.tabBarHeight) {
            this.tabsShown = true;
            this.tabBarElement!.classList.remove('tabs-hidden');
        }

        if (this.tabsShown && content.scrollHeight > content.clientHeight + (this.tabBarHeight - scroll)) {
            // Smooth translation.
            this.tabsElement.style.top = - scroll + 'px';
            this.tabsElement.style.height = 'calc(100% + ' + scroll + 'px';
        }
        // Use lastScroll after moving the tabs to avoid flickering.
        this.lastScroll = parseInt(scrollEvent.detail.scrollTop, 10);
    }

    /**
     * Tab selected.
     *
     * @param tabId Selected tab index.
     * @param e Event.
     */
    async selectTab(tabId: string, e?: Event): Promise<void> {
        let index = this.tabs.findIndex((tab) => tabId == tab.id);
        if (index < 0 || index >= this.tabs.length) {
            if (this.selected) {
                // Invalid index do not change tab.
                e && e.preventDefault();
                e && e.stopPropagation();

                return;
            }

            // Index isn't valid, select the first one.
            index = 0;
        }

        const selectedTab = this.tabs[index];
        if (tabId == this.selected || !selectedTab || !selectedTab.enabled) {
            // Already selected or not enabled.

            e && e.preventDefault();
            e && e.stopPropagation();

            return;
        }

        if (this.selected) {
            await this.slides!.slideTo(index);
        }

        const pageParams: NavigationOptions = {};
        if (selectedTab.pageParams) {
            pageParams.queryParams = selectedTab.pageParams;
        }
        const ok = await this.navCtrl.navigateForward(selectedTab.page, pageParams);

        if (ok) {
            this.selectHistory.push(tabId);
            this.selected = tabId;
            this.selectedIndex = index;

            this.ionChange.emit(selectedTab);

            const content = this.ionTabs!.outlet.nativeEl.querySelector('ion-content');

            if (content) {
                const scroll = await content.getScrollElement();
                content.scrollEvents = true;
                content.addEventListener('ionScroll', (e: CustomEvent): void => {
                    this.showHideTabs(e, scroll);
                });
            }
        }
    }

    /**
     * Adapt tabs to a window resize.
     */
    protected windowResized(): void {
        setTimeout(() => {
            this.calculateSlides();
        });
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.isDestroyed = true;

        if (this.resizeFunction) {
            window.removeEventListener('resize', this.resizeFunction);
        }
    }

}

/**
 * Core Tab class.
 */
class CoreTab {

    id = ''; // Unique tab id.
    class = ''; // Class, if needed.
    title = ''; // The translatable tab title.
    icon?: string; // The tab icon.
    badge?: string; // A badge to add in the tab.
    badgeStyle?: string; // The badge color.
    enabled = true; // Whether the tab is enabled.
    page = ''; // Page to navigate to.
    pageParams?: Params; // Page params.

}
