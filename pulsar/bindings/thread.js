import { Binding } from "../binding.js";
import { ExecutionContext, StopSignal, StopSignalError, Value, ValueTypeError, valueTypeToString } from "../runtime.js";

export class ThreadBindings extends Binding {
    #threadTypeId;
    #channelBindings;

    constructor(module) {
        super(module);
        this.#threadTypeId = null;
        this.#channelBindings = new ChannelBindings(module);
    }

    get threadTypeId() { return this.#threadTypeId; }

    bind() {
        this.#channelBindings.bind();

        this.#threadTypeId ??= this.module.bindCustomType("PulsarJS/Thread");
        this.module.bindNativeByName("this-thread/sleep!", context => this.#thisThreadSleep(context));
        this.module.bindNativeByName("thread/run",  context => this.#threadRun(context));
        this.module.bindNativeByName("thread/join", context => this.#threadJoin(context));
    }

    /** @param {ExecutionContext} context */
    async #thisThreadSleep(context) {
        const frame = context.currentFrame;
        const [ delay ] = frame.locals;
        if (!delay.isNumber())
            throw new ValueTypeError(`expected numeric delay, got ${valueTypeToString(delay.type)}`);
        if (delay.value > 0) {
            const stopSignal = context.stopSignal;
            await Promise.any([
                new Promise(res => setTimeout(res, Number(delay.value))),
                stopSignal.waitStop(),
            ]);
            stopSignal.handleRequest();
        }
    }

    /** @param {ExecutionContext} context */
    #threadRun(context) {
        const frame = context.currentFrame;
        const [ args, fnRef ] = frame.locals;
        if (!args.isList()) throw new ValueTypeError(`expected List for args, got ${valueTypeToString(args.type)}`);
        if (!fnRef.isFunctionReference()) throw new ValueTypeError(`expected FunctionReference for fn, got ${valueTypeToString(fnRef.type)}`);

        const fn = context.module.getFunctionByIndex(fnRef.value);

        // TODO: context fork
        const thread = new ExecutionContext(context.module);
        const threadData = { thread, error: null };
        frame.stack.push(Value.fromCustom(
            { typeId: this.threadTypeId, data: threadData }
        ));

        const threadStopSignal = new StopSignal();
        context.stopSignal.waitStop().then(() => {
            threadStopSignal.stop();
        });

        thread.stack.push(...args.value);
        try {
            thread.callFunction(fn);
            thread.runAsync(threadStopSignal).catch(error => {
                threadData.error = error;
                if (error instanceof StopSignalError) return;
                console.error(error);
            });
        } catch (error) {
            threadData.error = error;
        }
    }

    /** @param {ExecutionContext} context */
    async #threadJoin(context) {
        const frame = context.currentFrame;
        const [ thread ] = frame.locals;
        if (!thread.isCustomOf(this.threadTypeId))
            throw new ValueTypeError(`expected PulsarJS/Thread for thread, got ${valueTypeToString(thread.type)}`);
        const stopSignal = context.stopSignal;
        const threadData = thread.value.data;
        const threadStopSignal = threadData.thread.stopSignal;
        if (threadStopSignal != null && threadData.error == null) {
            await Promise.any([
                threadStopSignal.waitComplete(),
                stopSignal.waitStop(),
            ]);
            stopSignal.handleRequest();
        }

        frame.stack.push(Value.fromList(threadData.thread.stack));
        frame.stack.push(Value.fromInteger(threadData.error != null ? 1 : 0));
    }
}

export class ChannelBindings extends Binding {
    #channelTypeId;

    constructor(module) {
        super(module);
        this.#channelTypeId = null;
    }

    get channelTypeId() { return this.#channelTypeId; }

    bind() {
        this.#channelTypeId ??= this.module.bindCustomType("PulsarJS/Channel");
        this.module.bindNativeByName("channel/new",     context => this.#channelNew(context));
        this.module.bindNativeByName("channel/send!",   context => this.#channelSend(context));
        this.module.bindNativeByName("channel/receive", context => this.#channelReceive(context));
        this.module.bindNativeByName("channel/close!",  context => this.#channelClose(context));
        this.module.bindNativeByName("channel/empty?",  context => this.#channelEmpty(context));
        this.module.bindNativeByName("channel/closed?", context => this.#channelClosed(context));
    }

    /** @param {ExecutionContext} context */
    #channelNew(context) {
        context.currentFrame.stack.push(Value.fromCustom(
            { typeId: this.channelTypeId, data: { pipe: [], closed: false } }
        ));
    }

    /** @param {ExecutionContext} context */
    #channelSend(context) {
        const frame = context.currentFrame;
        const [ value, channel ] = frame.locals;
        if (!channel.isCustomOf(this.channelTypeId))
            throw new ValueTypeError(`expected PulsarJS/Channel for channel, got ${valueTypeToString(channel.type)}`);
        const channelData = channel.value.data;
        if (channelData.closed) return;
        channelData.pipe.unshift(value);
    }

    /** @param {ExecutionContext} context */
    async #channelReceive(context) {
        const frame = context.currentFrame;
        const [ channel ] = frame.locals;
        if (!channel.isCustomOf(this.channelTypeId))
            throw new ValueTypeError(`expected PulsarJS/Channel for channel, got ${valueTypeToString(channel.type)}`);

        const stopSignal  = context.stopSignal;
        const channelData = channel.value.data;
        while (channelData.pipe.length <= 0 && !channelData.closed) {
            await Promise.any([
                new Promise(res => setTimeout(res)),
                stopSignal.waitStop(),
            ]);
            stopSignal.handleRequest();
        }

        if (channelData.closed) {
            frame.stack.push(new Value());
        } else {
            frame.stack.push(channelData.pipe.pop());
        }
    }

    /** @param {ExecutionContext} context */
    #channelClose(context) {
        const frame = context.currentFrame;
        const [ channel ] = frame.locals;
        if (!channel.isCustomOf(this.channelTypeId))
            throw new ValueTypeError(`expected PulsarJS/Channel for channel, got ${valueTypeToString(channel.type)}`);
        const channelData = channel.value.data;
        channelData.closed = true;
    }

    /** @param {ExecutionContext} context */
    #channelEmpty(context) {
        const frame = context.currentFrame;
        const [ channel ] = frame.locals;
        if (!channel.isCustomOf(this.channelTypeId))
            throw new ValueTypeError(`expected PulsarJS/Channel for channel, got ${valueTypeToString(channel.type)}`);
        const channelData = channel.value.data;
        frame.stack.push(Value.fromInteger(channelData.pipe.length > 0 ? 0 : 1));
    }

    /** @param {ExecutionContext} context */
    #channelClosed(context) {
        const frame = context.currentFrame;
        const [ channel ] = frame.locals;
        if (!channel.isCustomOf(this.channelTypeId))
            throw new ValueTypeError(`expected PulsarJS/Channel for channel, got ${valueTypeToString(channel.type)}`);
        const channelData = channel.value.data;
        frame.stack.push(Value.fromInteger(channelData.closed ? 1 : 0));
    }
}
