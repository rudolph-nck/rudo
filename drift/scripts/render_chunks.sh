#!/bin/bash
# Render a composition in frame chunks (resumable: finished chunks are kept), then join with the audio.
# usage: scripts/render_chunks.sh <comp> <frames> <chunk> <out.mp4> [audio_offset_s]
set -e
COMP=$1; N=$2; C=$3; OUT=$4; AOFF=${5:-0}
DIR=$(dirname "$OUT")/$(basename "$OUT" .mp4)
mkdir -p "$DIR"
: > "$DIR/list.txt"
for ((a=0; a<N; a+=C)); do
  b=$((a+C-1)); [ $b -ge $N ] && b=$((N-1))
  f="$DIR/part_$(printf %05d $a).mp4"
  if [ ! -s "$f" ]; then
    npx remotion render src/index.ts "$COMP" "$DIR/tmp.mp4" --frames=$a-$b --props='{"muted":true}' --gl=swangle --concurrency=4 --log=error --timeout=240000 ${SCALE:+--scale=$SCALE}
    mv "$DIR/tmp.mp4" "$f"
    echo "done $a-$b $(date +%T)"
  fi
  echo "file '$(basename "$f")'" >> "$DIR/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$DIR/list.txt" -c copy "$DIR/video.mp4"
ffmpeg -v error -y -i "$DIR/video.mp4" -ss "$AOFF" -i public/audio/drift.m4a -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$OUT"
echo "OUT $OUT"
