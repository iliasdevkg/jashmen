import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';

/// The streak, on the profile — the twin of `src/components/StreakCalendar.jsx`.
///
/// Two views of the same data, one tap apart: this week as a Su–Sa strip with
/// a continuous bar under each run of studied days (the same visual the
/// celebration screen uses, so the two read as one idea), and the last four
/// weeks as a grid.
///
/// The month view is a real calendar month, with arrows either side of its
/// name. It used to be a rolling four weeks, because the server kept only a
/// trailing 30 days of `activeDays` and a month grid would have drawn empty
/// squares for days nobody had the answer to and quietly called them
/// "missed". The server keeps 400 days (routes.js), so paging back is honest
/// — and the grid still marks anything outside that window as unknown.
class StreakCalendar extends StatefulWidget {
  const StreakCalendar({
    super.key,
    required this.streak,
    required this.activeDays,
    this.repair,
    this.energy = 0,
    this.onRepair,
  });

  final int streak;
  final List<String> activeDays;

  /// The pending buy-it-back offer, or null when there is nothing to buy —
  /// see logic.dart#streakRepairOffer.
  final ({int lost, int cost})? repair;

  /// Energy the learner has right now, which is what the offer is paid
  /// from. Only used to decide whether the button can be pressed at all.
  final int energy;

  /// Throws on failure; the banner shows the message.
  final Future<void> Function()? onRepair;

  @override
  State<StreakCalendar> createState() => _StreakCalendarState();
}

const int _daysInWeek = 7;

/// How far back the server's `activeDays` reaches (routes.js). A day older
/// than this is unknown, not missed.
const int _historyDays = 400;

/// Kyrgyz month names — Intl has no `ky` data, and the Russian names it would
/// fall back to are not what a Kyrgyz interface should show.
const List<String> _monthsKy = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const List<String> _monthsEn = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/// Every cell of the grid for [year]/[month], Sunday-aligned. The days that
/// spill in from the neighbouring months are included so the weeks line up
/// under their headers, and flagged so they can be dimmed.
List<({String iso, bool inMonth})> _monthGrid(int year, int month) {
  final first = DateTime.utc(year, month, 1);
  final start = first.subtract(Duration(days: first.weekday % 7));
  final last = DateTime.utc(year, month + 1, 0);
  final end = last.add(Duration(days: 6 - (last.weekday % 7)));

  final cells = <({String iso, bool inMonth})>[];
  for (var d = start; !d.isAfter(end); d = d.add(const Duration(days: 1))) {
    cells.add((iso: _iso(d), inMonth: d.month == month));
  }
  return cells;
}

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// The Sunday that opens the week [weeksBack] weeks before the current one.
/// UTC throughout, because that is the clock the server's day boundary runs
/// on — a local-midnight week would disagree with the streak it is drawing.
DateTime _weekStart(int weeksBack) {
  final now = DateTime.now().toUtc();
  final today = DateTime.utc(now.year, now.month, now.day);
  return today.subtract(
    Duration(days: today.weekday % 7 + weeksBack * _daysInWeek),
  );
}

List<String> _daysFrom(DateTime start, int count) =>
    List.generate(count, (i) => _iso(start.add(Duration(days: i))));

/// Contiguous stretches of studied days, as (first, last) index pairs — what
/// turns seven separate dots into "these days connect".
List<(int, int)> _activeRuns(List<bool> active) {
  final runs = <(int, int)>[];
  var start = -1;
  for (var i = 0; i < active.length; i++) {
    if (active[i] && start == -1) start = i;
    if ((!active[i] || i == active.length - 1) && start != -1) {
      runs.add((start, active[i] ? i : i - 1));
      start = -1;
    }
  }
  return runs;
}

class _StreakCalendarState extends State<StreakCalendar> {
  bool _month = false;

  /// Which month the grid shows. 0 is this one; -1 is last month.
  int _offset = 0;

  bool _repairing = false;
  String _repairError = '';

  Future<void> _repair() async {
    final run = widget.onRepair;
    if (run == null || _repairing) return;
    setState(() {
      _repairing = true;
      _repairError = '';
    });
    try {
      await run();
    } catch (e) {
      if (mounted) {
        setState(() => _repairError =
            e is ApiException ? e.message : StringsScope.of(context)
                .t('profile.streakRepairNoEnergy'));
      }
    } finally {
      if (mounted) setState(() => _repairing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    final now = DateTime.now().toUtc();
    final today = _iso(now);
    final active = widget.activeDays.toSet();

    final week = _daysFrom(_weekStart(0), _daysInWeek);

    final cursor = DateTime.utc(now.year, now.month + _offset, 1);
    final cells = _monthGrid(cursor.year, cursor.month);

    // The oldest day the server can still answer for. Anything before it is
    // drawn as unknown rather than as a missed day.
    final horizon = _iso(now.subtract(const Duration(days: _historyDays)));

    // Paging stops where the data does in one direction and at this month in
    // the other — there is nothing to see in the future.
    final canGoBack =
        cells.any((c) => c.inMonth && c.iso.compareTo(horizon) >= 0);
    final canGoNext = _offset < 0;

    final monthName = switch (s.locale) {
      AppLocale.en => '${_monthsEn[cursor.month - 1]} ${cursor.year}',
      _ => '${_monthsKy[cursor.month - 1]} ${cursor.year}',
    };

    final monthDays = [for (final c in cells) if (c.inMonth) c.iso];
    final days = _month ? monthDays : week;
    final studied = days.where(active.contains).length;

    return Container(
      margin: const EdgeInsets.only(bottom: Gap.xl),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                const Icon(Icons.local_fire_department_rounded,
                    size: 22, color: AppColors.streak),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.t('league.days', params: {'n': widget.streak}),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                          color: tokens.text,
                        ),
                      ),
                      Text(
                        s.t('profile.streakSub'),
                        style: TextStyle(fontSize: 12, color: tokens.muted),
                      ),
                    ],
                  ),
                ),
                // Two tabs rather than a dropdown: with exactly two views, a
                // menu costs a tap and hides the choice.
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: tokens.bg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _Tab(
                        label: s.t('profile.streakWeek'),
                        on: !_month,
                        muted: tokens.muted,
                        onTap: () => setState(() => _month = false),
                      ),
                      _Tab(
                        label: s.t('profile.streakMonth'),
                        on: _month,
                        muted: tokens.muted,
                        onTap: () => setState(() => _month = true),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (widget.repair != null)
            _RepairBanner(
              repair: widget.repair!,
              energy: widget.energy,
              busy: _repairing,
              error: _repairError,
              onRepair: _repair,
              tokens: tokens,
              s: s,
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    for (var i = 0; i < _daysInWeek; i++)
                      Expanded(
                        child: Text(
                          s.t('streak.dow$i'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: tokens.muted,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                if (_month) ...[
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _MonthArrow(
                          icon: Icons.chevron_left_rounded,
                          label: s.t('profile.streakPrevMonth'),
                          enabled: canGoBack,
                          tokens: tokens,
                          onTap: () => setState(() => _offset -= 1),
                        ),
                        Text(
                          monthName,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: tokens.text,
                          ),
                        ),
                        _MonthArrow(
                          icon: Icons.chevron_right_rounded,
                          label: s.t('profile.streakNextMonth'),
                          enabled: canGoNext,
                          tokens: tokens,
                          onTap: () => setState(() => _offset += 1),
                        ),
                      ],
                    ),
                  ),
                ],
                if (!_month)
                  _WeekStrip(
                    week: week,
                    active: active,
                    today: today,
                    runs: _activeRuns(week.map(active.contains).toList()),
                    tokens: tokens,
                  )
                else
                  _MonthGrid(
                    cells: cells,
                    active: active,
                    today: today,
                    horizon: horizon,
                    tokens: tokens,
                  ),
                const SizedBox(height: 12),
                Text(
                  s.t('profile.streakStudied',
                      params: {'n': studied, 'total': days.length}),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: tokens.muted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.label,
    required this.on,
    required this.muted,
    required this.onTap,
  });

  final String label;
  final bool on;
  final Color muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: on ? AppColors.streak : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: on ? Colors.white : muted,
          ),
        ),
      ),
    );
  }
}

class _WeekStrip extends StatelessWidget {
  const _WeekStrip({
    required this.week,
    required this.active,
    required this.today,
    required this.runs,
    required this.tokens,
  });

  final List<String> week;
  final Set<String> active;
  final String today;
  final List<(int, int)> runs;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cell = c.maxWidth / _daysInWeek;
        return SizedBox(
          height: 34,
          child: Stack(
            children: [
              for (final (from, to) in runs)
                Positioned(
                  left: from * cell,
                  width: (to - from + 1) * cell,
                  top: 0,
                  height: 34,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(17),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3E8DFF), Color(0xFF7FB4FF)],
                      ),
                    ),
                  ),
                ),
              Row(
                children: [
                  for (final iso in week)
                    Expanded(
                      child: _DayMark(
                        iso: iso,
                        on: active.contains(iso),
                        isToday: iso == today,
                        future: iso.compareTo(today) > 0,
                        circle: true,
                        tokens: tokens,
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

/// The offer that appears on the day a run breaks: pay energy, get the
/// number back. It sits inside the streak card rather than as a dialog
/// because it is not urgent enough to interrupt — it is a choice the
/// learner should see next to the calendar that explains it.
class _RepairBanner extends StatelessWidget {
  const _RepairBanner({
    required this.repair,
    required this.energy,
    required this.busy,
    required this.error,
    required this.onRepair,
    required this.tokens,
    required this.s,
  });

  final ({int lost, int cost}) repair;
  final int energy;
  final bool busy;
  final String error;
  final VoidCallback onRepair;
  final dynamic tokens;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    final affordable = energy >= repair.cost;
    final bright = Theme.of(context).brightness == Brightness.light;
    final bg = bright ? const Color(0xFFFEF2F2) : const Color(0xFF2A1416);
    final line = bright ? const Color(0xFFFECACA) : const Color(0xFF7F1D1D);
    final strong = bright ? const Color(0xFF991B1B) : const Color(0xFFFCA5A5);
    final soft = bright ? const Color(0xFFB91C1C) : const Color(0xFFF87171);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: line, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(Icons.heart_broken_rounded,
                    size: 18, color: Color(0xFFEF4444)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.t('profile.streakLostTitle',
                          params: {'n': repair.lost}),
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        color: strong,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      s.t('profile.streakLostDesc',
                          params: {'cost': repair.cost}),
                      style: TextStyle(
                          fontSize: 11.5, height: 1.35, color: soft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Opacity(
            opacity: busy || !affordable ? 0.45 : 1,
            child: Material(
              color: AppColors.streak,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                onTap: busy || !affordable ? null : onRepair,
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (busy)
                        const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      else
                        const Icon(Icons.bolt_rounded,
                            size: 16, color: Colors.white),
                      const SizedBox(width: 6),
                      // Flexible, not fixed: the Kyrgyz label is the longest
                      // of the three and a two-digit price is a real setting,
                      // so the row has to give rather than overflow.
                      Flexible(
                        child: Text(
                          busy
                              ? s.t('profile.streakRepairBusy')
                              : s.t('profile.streakRepairCta',
                                  params: {'cost': repair.cost}),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Why the button is dead, said once — not a tooltip nobody opens.
          if (!affordable || error.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              error.isNotEmpty
                  ? error
                  : s.t('profile.streakRepairNoEnergy'),
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600, color: soft),
            ),
          ],
        ],
      ),
    );
  }
}

class _MonthArrow extends StatelessWidget {
  const _MonthArrow({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.tokens,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final dynamic tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : 0.25,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(9),
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tokens.bg,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 17, color: tokens.muted),
          ),
        ),
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.cells,
    required this.active,
    required this.today,
    required this.horizon,
    required this.tokens,
  });

  final List<({String iso, bool inMonth})> cells;
  final Set<String> active;
  final String today;

  /// Oldest day the server still has an answer for.
  final String horizon;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: _daysInWeek,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 4,
      crossAxisSpacing: 4,
      children: [
        for (final c in cells)
          _DayMark(
            iso: c.iso,
            on: active.contains(c.iso),
            isToday: c.iso == today,
            future: c.iso.compareTo(today) > 0,
            // Spill-over days belong to the neighbouring month, and anything
            // older than the history window is unknown rather than missed —
            // both are dimmed so neither reads as a day the learner skipped.
            faded: !c.inMonth || c.iso.compareTo(horizon) < 0,
            circle: false,
            tokens: tokens,
          ),
      ],
    );
  }
}

class _DayMark extends StatelessWidget {
  const _DayMark({
    required this.iso,
    required this.on,
    required this.isToday,
    required this.future,
    required this.circle,
    required this.tokens,
    this.faded = false,
  });

  final String iso;
  final bool on;
  final bool isToday;
  final bool future;
  final bool circle;
  final bool faded;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    // On the week strip the run bar behind already carries the colour, so a
    // studied day is transparent and only its tick shows.
    final filled = on && !circle;
    return Opacity(
      opacity: future ? 0.42 : (faded ? 0.3 : 1),
      child: Container(
        margin: circle ? const EdgeInsets.symmetric(horizontal: 2) : EdgeInsets.zero,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on && circle ? Colors.transparent : (filled ? null : tokens.bg),
          gradient: filled
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF7FB4FF), AppColors.streak],
                )
              : null,
          borderRadius: BorderRadius.circular(circle ? 17 : 9),
          border: isToday
              ? Border.all(color: AppColors.streak, width: 1.5)
              : null,
        ),
        child: Text(
          on && circle ? '✓' : iso.substring(8),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: on ? const Color(0xFF062A66) : tokens.muted,
          ),
        ),
      ),
    );
  }
}
