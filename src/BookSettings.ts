import BookView from "./BookView";
import * as HTMLUtilities from "./HTMLUtilities";
import Store from "./Store";

const template = (sections: string) => `
    <ul>
        ${sections}
    </ul>
`;

const sectionTemplate = (sectionName: string, options: string) => `
    <li>${sectionName}<ul>
        ${options}
    </ul></li>
`;

const optionTemplate = (className: string, label: string) => `
    <li><a href='#' class='${className}'>${label}</a></li>
`;

export default class BookSettings {
    private readonly store: Store;
    private readonly bookViews: BookView[];
    private viewLinks: { [key: string]: HTMLAnchorElement };
    private readonly fontSizes: string[];
    private fontSizeLinks: { [key: string]: HTMLAnchorElement };

    private viewChangeCallback: () => void;
    private fontSizeChangeCallback: () => void;

    private selectedView: BookView;
    private selectedFontSize: string;

    private static readonly SELECTED_VIEW_KEY = "settings-selected-view";
    private static readonly SELECTED_FONT_SIZE_KEY = "settings-selected-font-size";

    /** @param store Store to save the user's selections in. */
    /** @param bookViews Array of BookView options. */
    /** @param fontSizesInPixels Array of font sizes in pixels sorted from smallest to largest. */
    /** @param defaultFontSizeInPixels Initial font size to use until the user makes a selection. */
    public static async create(store: Store, bookViews: BookView[], fontSizesInPixels: number[], defaultFontSizeInPixels?: number) {
        const fontSizes = fontSizesInPixels.map(fontSize => fontSize + "px");
        const settings = new this(store, bookViews, fontSizes);
        await settings.initializeSelections(defaultFontSizeInPixels ? defaultFontSizeInPixels + "px" : undefined);
        return settings;
    }

    protected constructor(store: Store, bookViews: BookView[], fontSizes: string[]) {
        this.store = store;
        this.bookViews = bookViews;
        this.fontSizes = fontSizes;
    }

    private async initializeSelections(defaultFontSize?: string): Promise<void> {
        if (this.bookViews.length >= 1) {
            let selectedView = this.bookViews[0];
            const selectedViewName = await this.store.get(BookSettings.SELECTED_VIEW_KEY);
            if (selectedViewName) {
                for (const bookView of this.bookViews) {
                    if (bookView.name === selectedViewName) {
                        selectedView = bookView;
                        break;
                    }
                }
            }
            this.selectedView = selectedView;
        }

        if (this.fontSizes.length >= 1) {
            // First, check if the user has previously set a font size.
            let selectedFontSize = await this.store.get(BookSettings.SELECTED_FONT_SIZE_KEY);
            let selectedFontSizeIsAvailable = (selectedFontSize && this.fontSizes.indexOf(selectedFontSize) !== -1);
            // If not, or the user selected a size that's no longer an option, is there a default font size?
            if ((!selectedFontSize || !selectedFontSizeIsAvailable) && defaultFontSize) {
                selectedFontSize = defaultFontSize;
                selectedFontSizeIsAvailable = (selectedFontSize && this.fontSizes.indexOf(selectedFontSize) !== -1);
            }
            // If there's no selection and no default, pick a font size in the middle of the options.
            if (!selectedFontSize || !selectedFontSizeIsAvailable) {
                const averageFontSizeIndex = Math.floor(this.fontSizes.length / 2);
                selectedFontSize = this.fontSizes[averageFontSizeIndex];
            }
            this.selectedFontSize = selectedFontSize;
        }
    }

    public renderControls(element: HTMLElement): void {
        const sections = [];

        if (this.bookViews.length > 1) {
            const viewOptions = this.bookViews.map(bookView =>
                optionTemplate(bookView.name, bookView.label)
            );
            sections.push(sectionTemplate("View", viewOptions.join("")));
        }

        if (this.fontSizes.length > 1) {
            const fontSizeOptions = optionTemplate("decrease", "Decrease") + optionTemplate("increase", "Increase");
            sections.push(sectionTemplate("Font Size", fontSizeOptions));
        }

        element.innerHTML = template(sections.join(""));
        this.viewLinks = {};
        if (this.bookViews.length > 1) {
            for (const bookView of this.bookViews) {
                this.viewLinks[bookView.name] = HTMLUtilities.findRequiredElement(element, "a[class=" + bookView.name + "]") as HTMLAnchorElement;
            }
            this.updateViewLinks();
        }
        this.fontSizeLinks = {};
        if (this.fontSizes.length > 1) {
            for (const fontSizeName of ["decrease", "increase"]) {
                this.fontSizeLinks[fontSizeName] = HTMLUtilities.findRequiredElement(element, "a[class=" + fontSizeName + "]") as HTMLAnchorElement;
            }
            this.updateFontSizeLinks();
        }
        
        this.setupEvents();
    }

    public onViewChange(callback: () => void) {
        this.viewChangeCallback = callback;
    }

    public onFontSizeChange(callback: () => void) {
        this.fontSizeChangeCallback = callback;
    }

    private setupEvents(): void {
        for (const view of this.bookViews) {
            const link = this.viewLinks[view.name];
            if (link) {
                link.addEventListener("click", (event: MouseEvent) => {
                    const position = this.selectedView.getCurrentPosition();
                    this.selectedView.stop();
                    view.start(position);
                    this.selectedView = view;
                    this.updateViewLinks();
                    this.storeSelectedView(view);
                    if (this.viewChangeCallback) {
                        this.viewChangeCallback();
                    }
                    event.preventDefault();
                });
            }
        }

        if (this.fontSizes.length > 1) {
            this.fontSizeLinks["decrease"].addEventListener("click", (event: MouseEvent) => {
                const currentFontSizeIndex = this.fontSizes.indexOf(this.selectedFontSize);
                if (currentFontSizeIndex > 0) {
                    const newFontSize = this.fontSizes[currentFontSizeIndex - 1];
                    this.selectedFontSize = newFontSize;
                    if (this.fontSizeChangeCallback) {
                        this.fontSizeChangeCallback();
                    }
                    this.updateFontSizeLinks();
                    this.storeSelectedFontSize(newFontSize);
                }
                event.preventDefault();
            });

            this.fontSizeLinks["increase"].addEventListener("click", (event: MouseEvent) => {
                const currentFontSizeIndex = this.fontSizes.indexOf(this.selectedFontSize);
                if (currentFontSizeIndex < this.fontSizes.length - 1) {
                    const newFontSize = this.fontSizes[currentFontSizeIndex + 1];
                    this.selectedFontSize = newFontSize;
                    if (this.fontSizeChangeCallback) {
                        this.fontSizeChangeCallback();
                    }
                    this.updateFontSizeLinks();
                    this.storeSelectedFontSize(newFontSize);
                }
                event.preventDefault();
            });
        }
    }

    private updateViewLinks(): void {
        for (const view of this.bookViews) {
            if (view === this.selectedView) {
                this.viewLinks[view.name].className = view.name + " active";
            } else {
                this.viewLinks[view.name].className = view.name;
            }
        }
    }

    private updateFontSizeLinks(): void {
        const currentFontSizeIndex = this.fontSizes.indexOf(this.selectedFontSize);

        if (currentFontSizeIndex === 0) {
            this.fontSizeLinks["decrease"].className = "decrease disabled";
        } else {
            this.fontSizeLinks["decrease"].className = "decrease";
        }

        if (currentFontSizeIndex === this.fontSizes.length - 1) {
            this.fontSizeLinks["increase"].className = "increase disabled";
        } else {
            this.fontSizeLinks["increase"].className = "increase";
        }
    }

    public getSelectedView(): BookView {
        return this.selectedView;
    }

    public getSelectedFontSize(): string {
        return this.selectedFontSize;
    }

    private async storeSelectedView(view: BookView): Promise<void> {
        return this.store.set(BookSettings.SELECTED_VIEW_KEY, view.name);
    }

    private async storeSelectedFontSize(fontSize: string): Promise<void> {
        return this.store.set(BookSettings.SELECTED_FONT_SIZE_KEY, fontSize);
    }
};