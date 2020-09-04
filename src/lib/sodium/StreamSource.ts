import { Stream } from "./Stream";
import { StreamSinkVertex } from './Vertex';

type HandleElement<A> = (A) => void;

type RemoveListener = () => void;

type AddListener<A> = (handle: HandleElement<A>) => RemoveListener;

class StreamSourceVertex<A> extends StreamSinkVertex<A> {
    private removeListener?: RemoveListener = undefined;

    constructor(
        private readonly addListener: AddListener<A>,
    ) {
        super();
    }

    initialize(): void {
        super.initialize();
        this.removeListener = this.addListener((a) => {
            this.fire(a);
        });
    }

    uninitialize(): void {
        this.removeListener!();
        this.removeListener = undefined;
        super.uninitialize();
    }
}

export class StreamSource<A> extends Stream<A> {
    constructor(args: {
        addListener: AddListener<A>
    }) {
        super(new StreamSourceVertex(args.addListener));
    }
}
