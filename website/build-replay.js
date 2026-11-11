import { startReplay } from './replay-controls.js';

export function initReplay(viewport) {
  const duration = 60_000;
  const analysisEnd = 3600;
  const actionsShown = 5;
  const target = '//bootdisk:bootdisk';
  const image = 'bootdisk/bootdisk.img';
  const format = new Intl.NumberFormat('en-US');

  // A fictional cross-platform release graph with real source and package names.
  // Each batch stands in for independent actions across the release matrix.
  const tracks = [
    {
      shards: [0, 3, 6, 9],
      waves: 32,
      messages: [
        'Compiling init/main.c',
        'Compiling kernel/sched/core.c',
        'Compiling fs/ext4/inode.c',
        'Compiling drivers/virtio/virtio.c',
        'Compiling net/core/dev.c',
      ],
    },
    {
      shards: [1, 4, 7, 10, 11],
      waves: 36,
      messages: [
        'Compiling Rust lib //rust-analyzer:syntax',
        'Compiling Rust lib //rust-analyzer:hir_def',
        'Compiling Rust lib //rust-analyzer:hir_ty',
        'Compiling Rust lib //rust-analyzer:project_model',
        'Compiling Rust lib //rust-analyzer:ide',
      ],
    },
    {
      shards: [2, 5, 8],
      waves: 37,
      messages: [
        'GoCompilePkg pkg/abi/linux/linux.a',
        'GoCompilePkg pkg/sentry/kernel/kernel.a',
        'GoCompilePkg pkg/sentry/vfs/vfs.a',
        'GoCompilePkg pkg/tcpip/stack/stack.a',
        'GoCompilePkg runsc/boot/boot.a',
      ],
    },
  ];
  const compileBatches = tracks.flatMap(({ shards, waves, messages }) =>
    Array.from({ length: waves }, (_, wave) => shards.map(shard => {
      const start = 3700 + wave * 1300 + shard * 88;
      return {
        start,
        end: start + 960 + (shard * 53 + wave * 67) % 320,
        count: 176 + (wave * 19 + shard * 7) % 23,
        message: messages[(wave + shard) % messages.length],
      };
    })).flat(),
  );
  // The EROFS root filesystem consumes both application binaries. DiskImage
  // assembles it with the EFI and writable partitions.
  const packaging = [
    [3400, 3650, 'Compiling tools/objtool/objtool.c'],
    [8700, 11_600, 'LayerCpio initrd/initrd.cpio.gz'],
    [18_800, 21_000, 'LayerExt4 state/var_layer.ext4'],
    [19_700, 22_200, 'LayerExt4 state/home_layer.ext4'],
    [46_000, 49_000, 'Linking vmlinux'],
    [49_000, 51_500, 'Building unified kernel image boot/uki.efi'],
    [51_400, 55_000, 'Compiling Rust bin //rust-analyzer:rust-analyzer'],
    [51_500, 53_200, 'LayerFat32 boot/esp_layer.fat32'],
    [53_000, 55_200, 'GoLink runsc/runsc'],
    [55_200, 57_600, 'LayerErofs rootfs/root_layer.erofs'],
    [57_600, duration, `DiskImage ${image}`],
  ].map(([start, end, message]) => ({ start, end, message, count: 1 }));
  const remoteActions = [...compileBatches, ...packaging].sort((a, b) => a.start - b.start);
  const cacheBatches = Array.from({ length: 128 }, (_, index) => ({
    end: 3800 + index * 403 + (index * 127) % 240,
    count: 4900 + (index * 2449) % 6700,
  }));
  const internal = 8426;
  const countActions = actions => actions.reduce((total, action) => total + action.count, 0);
  const cacheHits = countActions(cacheBatches);
  const remote = countActions(remoteActions);
  const total = cacheHits + internal + remote;
  const isRunning = (action, time) => action.start <= time && time < action.end;
  const peak = Math.max(...remoteActions.map(({ start }) =>
    countActions(remoteActions.filter(action => isRunning(action, start))),
  ));

  const analyzed = `INFO: Analyzed target ${target} (11872 packages loaded, 284706 targets configured).`;
  const summary = [
    analyzed,
    'INFO: Found 1 target...',
    `Target ${target} up-to-date:`,
    `  bazel-bin/${image}`,
    'INFO: Elapsed time: 60.000s, Critical Path: 56.6s',
    `INFO: ${total} processes: ${cacheHits} remote cache hit, ${internal} internal, ${remote} remote.`,
    `INFO: Build completed successfully, ${total} total actions`,
  ].join('\n');

  const replay = document.querySelector('.build-replay');
  const output = replay.querySelector('.build-output');

  function render(time) {
    if (time < 350) {
      output.textContent = 'Computing main repo mapping:';
      return;
    }
    if (time < analysisEnd) {
      const progress = (time - 350) / (analysisEnd - 350);
      output.textContent = `Analyzing: target ${target} (${Math.floor(11872 * progress)} packages loaded, ${Math.floor(284706 * progress)} targets configured)`;
      return;
    }
    if (time === duration) {
      output.textContent = summary;
      return;
    }

    const active = remoteActions.filter(action => isRunning(action, time));
    const completed = internal
      + countActions(cacheBatches.filter(action => time >= action.end))
      + countActions(remoteActions.filter(action => time >= action.end));
    const progress = `[${format.format(completed)} / ${format.format(total)}]`;
    const describe = action => `${action.message}; ${Math.floor((time - action.start) / 1000)}s remote`;
    const running = countActions(active);
    if (running <= 1) {
      const detail = running === 1 ? describe(active[0]) : 'checking cached actions';
      output.textContent = `${analyzed}\n${progress} ${detail}`;
      return;
    }

    const sample = [];
    const seen = new Set();
    for (const action of active) {
      if (seen.has(action.message)) continue;
      seen.add(action.message);
      sample.push('    ' + describe(action));
      if (sample.length === actionsShown) break;
    }
    if (running > sample.length) sample[sample.length - 1] += ' ...';
    output.textContent = [analyzed, `${progress} ${running} actions running`, ...sample].join('\n');
  }

  startReplay(replay, {
    viewport,
    duration,
    renderInterval: 120,
    render,
    completionMessage: `UEFI disk image complete in 60 seconds. ${format.format(total)} actions, with ${format.format(peak)} remote actions running at peak.`,
  });
}
