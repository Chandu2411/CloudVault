package com.cloudmigration.util;

import com.cloudmigration.service.TransferProgressStore;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

/**
 * A FilterInputStream that counts every byte read and reports it to
 * {@link TransferProgressStore} in real-time.
 *
 * <p>This is the ONLY source of truth for transfer progress.
 * There are NO timers, NO random numbers, NO simulated progress.
 * Every call to read() that returns bytes increments the store counter.
 *
 * <p>Wraps the PipedInputStream on the upload side — so it counts bytes
 * as the Google Drive upload API reads them from the pipe (i.e., as they
 * are actually sent to the destination drive).
 */
public class CountingInputStream extends FilterInputStream {

    private final TransferProgressStore store;
    private final UUID jobId;
    private final UUID itemId;

    public CountingInputStream(InputStream in,
                               TransferProgressStore store,
                               UUID jobId,
                               UUID itemId) {
        super(in);
        this.store  = store;
        this.jobId  = jobId;
        this.itemId = itemId;
    }

    @Override
    public int read() throws IOException {
        int b = super.read();
        if (b != -1) store.addBytes(jobId, itemId, 1);
        return b;
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
        int n = super.read(b, off, len);
        if (n > 0) store.addBytes(jobId, itemId, n);
        return n;
    }

    @Override
    public long skip(long n) throws IOException {
        long skipped = super.skip(n);
        if (skipped > 0) store.addBytes(jobId, itemId, skipped);
        return skipped;
    }
}
