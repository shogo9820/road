declare const _exports: {
    JOBS: ({
        id: string;
        label: string;
        title: string;
        cap: number;
        special?: undefined;
    } | {
        id: string;
        label: string;
        title: string;
        cap: number;
        special: string;
    })[];
    MAP_SQUARES: ({
        id: number;
        type: string;
        text: string;
        mode: string;
        nextId: number[];
        jobId?: undefined;
        isGoal?: undefined;
    } | {
        id: number;
        type: string;
        text: string;
        jobId: string;
        mode: string;
        nextId: number[];
        isGoal?: undefined;
    } | {
        jobId?: undefined;
        id: number;
        type: string;
        text: string;
        isGoal: boolean;
        mode: string;
        nextId: any[];
    })[];
    createPlayer: typeof createPlayer;
};
export = _exports;
declare function createPlayer(id: any, name: any): {
    id: any;
    name: any;
    jobId: string;
    job: string;
    baseCap: number;
    bonusCap: number;
    currentHp: number;
    drinkCount: number;
    happiness: number;
    position: number;
    location: string;
    insurance: number;
    isLover: boolean;
    skipTurn: boolean;
    hasJob: boolean;
    lovers: undefined[];
};
//# sourceMappingURL=gameMaster.d.ts.map