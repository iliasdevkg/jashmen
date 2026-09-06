/// Tap a picture, see the picture — the twin of
/// src/components/ZoomableImage.jsx.
///
/// Every image the admin uploads is content a learner may genuinely want to
/// read: the fine print on a partner's voucher, the diagram inside a lesson,
/// what the coffee actually looks like. In a card it is a hundred-odd pixels
/// tall and the answer is not in there.
///
/// This wraps whatever already draws the image rather than replacing it, so
/// every call site keeps its own placeholder, error fallback and fit — the
/// wrapper only adds the tap and the flight to the full-screen view. Pinch
/// and pan there come from [InteractiveViewer]; the web twin has to
/// implement both by hand because index.html turns the browser's own pinch
/// off app-wide.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/i18n.dart';

/// How far a pinch may push it. Five is enough to read a code printed small
/// on a photo, and is where the source pixels give out anyway.
const double _maxScale = 5.0;

class ZoomableImage extends StatelessWidget {
  const ZoomableImage({
    super.key,
    required this.imageUrl,
    required this.tag,
    required this.child,
    this.caption,
  });

  final String imageUrl;

  /// Unique on the screen this sits on — a prize id, a card index. Two
  /// heroes sharing a tag is a crash, and the same photo really can appear
  /// on two prizes, so the URL alone will not do.
  final String tag;

  /// The widget that already draws this image in place.
  final Widget child;

  /// Shown under the full-screen image. The card's own caption, usually.
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    return Semantics(
      button: true,
      label: s.t('common.zoomImage'),
      child: GestureDetector(
        // Opaque, not deferToChild: the wrapped widget is sometimes a
        // letterboxed image sitting in a larger box, and a tap on the
        // padding around it should still open the picture.
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).push(
          PageRouteBuilder(
            opaque: false,
            barrierColor: Colors.transparent,
            transitionDuration: const Duration(milliseconds: 220),
            reverseTransitionDuration: const Duration(milliseconds: 180),
            pageBuilder: (_, __, ___) => _ImageViewer(
              imageUrl: imageUrl,
              tag: 'zoom:$tag',
              caption: caption,
            ),
            transitionsBuilder: (_, animation, __, child) =>
                FadeTransition(opacity: animation, child: child),
          ),
        ),
        child: Hero(tag: 'zoom:$tag', child: child),
      ),
    );
  }
}

class _ImageViewer extends StatefulWidget {
  const _ImageViewer({
    required this.imageUrl,
    required this.tag,
    this.caption,
  });

  final String imageUrl;
  final String tag;
  final String? caption;

  @override
  State<_ImageViewer> createState() => _ImageViewerState();
}

class _ImageViewerState extends State<_ImageViewer> {
  final _controller = TransformationController();

  /// Tracks whether a pinch has actually moved the image. While it has, a
  /// tap must not dismiss — a finger lifting off a two-finger gesture would
  /// otherwise close the picture the moment it was enlarged.
  bool _zoomed = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final z = _controller.value.getMaxScaleOnAxis() > 1.02;
      if (z != _zoomed) setState(() => _zoomed = z);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _reset() {
    _controller.value = Matrix4.identity();
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final caption = widget.caption?.trim() ?? '';

    return Scaffold(
      backgroundColor: const Color(0xF00F172A),
      body: Stack(
        children: [
          // Anything outside the picture dismisses, the way the backdrop
          // does on the web. Zoomed in, it resets instead — at that point a
          // stray tap is far more likely to be a missed pan.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _zoomed ? _reset : () => Navigator.of(context).maybePop(),
              child: Center(
                child: InteractiveViewer(
                  transformationController: _controller,
                  minScale: 1,
                  maxScale: _maxScale,
                  child: Hero(
                    tag: widget.tag,
                    child: CachedNetworkImage(
                      imageUrl: widget.imageUrl,
                      fit: BoxFit.contain,
                      placeholder: (_, __) => const SizedBox(
                        width: 44,
                        height: 44,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Colors.white54),
                      ),
                      errorWidget: (_, __, ___) => const Icon(
                          Icons.broken_image_rounded,
                          size: 44,
                          color: Colors.white38),
                    ),
                  ),
                ),
              ),
            ),
          ),

          if (caption.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: IgnorePointer(
                child: Container(
                  padding: const EdgeInsets.fromLTRB(24, 40, 24, 34),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x000F172A), Color(0xE60F172A)],
                    ),
                  ),
                  child: Text(
                    caption,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      color: Color(0xD1FFFFFF),
                    ),
                  ),
                ),
              ),
            ),

          Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Semantics(
                  button: true,
                  label: s.t('common.close'),
                  child: Material(
                    color: const Color(0x1FFFFFFF),
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => Navigator.of(context).maybePop(),
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Icon(Icons.close_rounded,
                            size: 22, color: Color(0xE6FFFFFF)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
